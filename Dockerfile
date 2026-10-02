# Lives at the repo root, not apps/api/ — deliberately. This is a pnpm workspace (@tbc/api
# depends on @tbc/pricing and @tbc/shared-types via "workspace:*"), so the build needs the whole
# monorepo as its context, not just apps/api. Cloud Run's `gcloud run deploy --source .` only
# ever looks for a Dockerfile at the root of whatever directory you point --source at — there is
# no flag to point it at a subdirectory's Dockerfile (verified against gcloud's own reference
# docs; an earlier version of this file claimed a --dockerfile flag existed, which was wrong).
# Putting the Dockerfile here, at the context root, is what makes the zero-flag deploy commands
# below actually work:
#   docker build -t lickyeat-api .
#   gcloud run deploy lickyeat-api --source . --region <region>
#
# The admin dashboard has its own apps/admin/Dockerfile, built via an explicit `-f` step in
# cloudbuild.admin.yaml — this root file stays the API's, so --source deploys keep working.

FROM node:20-slim AS build
# python3/make/g++ are needed to compile bcrypt's native addon during `pnpm install` — there's
# no prebuilt binary for every possible base image/arch combination, so building from source
# here is the reliable path.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable

WORKDIR /repo
COPY . .
# Filtered install: only @tbc/api and its own workspace deps (@tbc/pricing, @tbc/shared-types). A
# full workspace install would also pull the mobile app's entire Expo tree — slow, large, and its
# postinstall scripts aren't needed (or guaranteed to succeed) inside a Linux API container.
RUN pnpm install --frozen-lockfile --filter "@tbc/api..."
# pnpm's own topological build (pricing + shared-types first, then the API), not turbo — turbo is a
# root-level devDependency and isn't installed by the filtered install above.
RUN pnpm --filter "@tbc/api..." run build

FROM node:20-slim AS runtime
ENV NODE_ENV=production
WORKDIR /repo

# Whole workspace, not just apps/api: pnpm's node_modules relies on symlinks between workspace
# packages (@tbc/pricing, @tbc/shared-types) and the workspace root's node_modules — copying
# only apps/api would leave those symlinks dangling.
# --chown=node:node so the non-root USER below actually owns what it needs to read; `node` is
# node:20-slim's own built-in non-root user (UID 1000) — no need to create one. This container
# never writes to local disk at runtime (image uploads go to GCS when GCS_BUCKET_NAME is set,
# which it always is in production), so dropping root has no write-access fallout.
COPY --from=build --chown=node:node /repo /repo

# Cloud Run injects PORT (defaults to 8080) — apps/api/src/index.ts already listens on
# env.PORT (via config/env.ts), so no code change was needed for this.
EXPOSE 8080
WORKDIR /repo/apps/api
USER node
CMD ["node", "dist/index.js"]

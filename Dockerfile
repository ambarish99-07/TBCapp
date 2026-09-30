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
# If a second service in this monorepo ever needs its own Dockerfile (e.g. apps/admin), this
# single-root-Dockerfile setup stops being unambiguous — revisit then (e.g. Cloud Build with an
# explicit `docker build -f <path> .` step instead of plain --source deploy).

FROM node:20-slim AS build
# python3/make/g++ are needed to compile bcrypt's native addon during `pnpm install` — there's
# no prebuilt binary for every possible base image/arch combination, so building from source
# here is the reliable path.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable

WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
# --filter @tbc/api... also builds @tbc/pricing and @tbc/shared-types first (turbo.json's
# `build` task depends on `^build`, i.e. a package's own dependencies build before it does).
RUN pnpm exec turbo run build --filter=@tbc/api...

FROM node:20-slim AS runtime
ENV NODE_ENV=production
WORKDIR /repo

# Whole workspace, not just apps/api: pnpm's node_modules relies on symlinks between workspace
# packages (@tbc/pricing, @tbc/shared-types) and the workspace root's node_modules — copying
# only apps/api would leave those symlinks dangling.
COPY --from=build /repo /repo

# Cloud Run injects PORT (defaults to 8080) — apps/api/src/index.ts already listens on
# env.PORT (via config/env.ts), so no code change was needed for this.
EXPOSE 8080
WORKDIR /repo/apps/api
CMD ["node", "dist/index.js"]

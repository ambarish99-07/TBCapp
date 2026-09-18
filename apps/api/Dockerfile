# Build context MUST be the repo root (this is a pnpm workspace — @tbc/api depends on
# @tbc/pricing and @tbc/shared-types via "workspace:*", so the whole monorepo is needed to
# install and build it). Build from the repo root:
#   docker build -f apps/api/Dockerfile -t lickyeat-api .
# Cloud Run's `gcloud run deploy --source .` looks for a root-level Dockerfile by default, so
# when deploying via that command, point it at the repo root and pass this file explicitly:
#   gcloud run deploy lickyeat-api --source . --dockerfile apps/api/Dockerfile --region <region>

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

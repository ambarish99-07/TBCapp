# Build context MUST be the repo root (pnpm workspace — @tbc/admin depends on @tbc/shared-types via
# "workspace:*"). The repo root's own Dockerfile is the API's (so the API can use gcloud's zero-flag
# `--source .` deploy); this one is built via an explicit -f step in cloudbuild.admin.yaml instead:
#   gcloud builds submit --config=cloudbuild.admin.yaml . --substitutions=...
#
# The three VITE_* values are baked into the JS bundle at `vite build` time (Vite inlines
# import.meta.env.VITE_* — same behaviour as Next's NEXT_PUBLIC_*). They're ALSO set at runtime
# below, because server/server.ts reads the two API ones to build the CSP connect-src allowlist.
# Changing any of them means rebuilding this image.

FROM node:20-slim AS build
RUN corepack enable

ARG VITE_API_BASE_URL
ARG VITE_WEBSITE_API_BASE_URL
ARG VITE_WEBSITE_ADMIN_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_WEBSITE_API_BASE_URL=$VITE_WEBSITE_API_BASE_URL
ENV VITE_WEBSITE_ADMIN_URL=$VITE_WEBSITE_ADMIN_URL

WORKDIR /repo
COPY . .
# Filtered install: only @tbc/admin and its own workspace deps. A full workspace install would also
# pull the mobile app's Expo tree and the API's native bcrypt addon, neither of which this needs.
RUN pnpm install --frozen-lockfile --filter "@tbc/admin..."
# pnpm's own topological build (shared-types first, then admin), not turbo — turbo is a root-level
# devDependency and isn't installed by the filtered install above.
RUN pnpm --filter "@tbc/admin..." run build

FROM node:20-slim AS runtime
ENV NODE_ENV=production
ARG VITE_API_BASE_URL
ARG VITE_WEBSITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_WEBSITE_API_BASE_URL=$VITE_WEBSITE_API_BASE_URL
WORKDIR /repo

# Whole workspace (pnpm symlinks), owned by node:20-slim's built-in non-root `node` user.
# This container only serves static files — it never writes to disk.
COPY --from=build --chown=node:node /repo /repo

EXPOSE 8080
WORKDIR /repo/apps/admin
USER node
CMD ["node_modules/.bin/tsx", "server/server.ts"]

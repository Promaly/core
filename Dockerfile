# node:24-bookworm-slim
FROM node@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e AS build

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/sdk/package.json packages/sdk/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY . .
RUN pnpm build

# node:24-bookworm-slim
FROM node@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e AS runtime

WORKDIR /app
ENV NODE_ENV=production
# The runtime uses corepack -> pnpm for install and `node` directly to run.
# npm is never invoked, and the copy bundled with the base image carries its own
# (vendored, unpatched) dependency tree that the image scanner flags. Drop it.
RUN corepack enable \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/sdk/package.json packages/sdk/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile --prod

COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/web/dist apps/web/dist
COPY --from=build /app/apps/worker/dist apps/worker/dist
COPY --from=build /app/packages/config/dist packages/config/dist
COPY --from=build /app/packages/contracts/dist packages/contracts/dist
COPY --from=build /app/packages/db/dist packages/db/dist
COPY --from=build /app/packages/db/drizzle packages/db/drizzle
COPY --from=build /app/packages/domain/dist packages/domain/dist
COPY --from=build /app/packages/sdk/dist packages/sdk/dist
COPY --from=build /app/packages/ui/dist packages/ui/dist

EXPOSE 3000
USER node
CMD ["node", "apps/api/dist/main.js"]

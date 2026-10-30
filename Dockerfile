# syntax=docker/dockerfile:1.10
#
# Targets:
#   runner (default)  Next.js standalone server, the only image that serves traffic.
#   worker            Source plus full dependencies for scripts/run-worker.ts and
#                     one-shot tasks such as `bun run db:migrate`.
#
# NEXT_SERVER_ACTIONS_ENCRYPTION_KEY is embedded into the build output, so it is
# a build input, not just a runtime variable. Pass it as a BuildKit secret:
#   docker build --secret id=next_server_actions_encryption_key,env=NEXT_SERVER_ACTIONS_ENCRYPTION_KEY .
# Every replica of one release must be built with the identical key, and the key
# should stay stable across releases so rolling deployments keep working.

FROM oven/bun:1.4.0-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
COPY package.json bun.lock ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/mobile/package.json ./apps/mobile/package.json
# lefthook's `prepare` hook needs git, which an image build neither has nor needs.
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --ignore-scripts

FROM base AS build
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
# Placeholders satisfy configuration checks during `next build`; the build never
# connects to them and runtime values come from the container environment.
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
# The auth secret is passed on the command, not as ENV, so no image layer keeps it.
RUN --mount=type=secret,id=next_server_actions_encryption_key,env=NEXT_SERVER_ACTIONS_ENCRYPTION_KEY,required=true \
    BETTER_AUTH_SECRET=build-only-secret-never-used-at-runtime-000000000000 \
    bun run build

FROM base AS worker
ENV NODE_ENV=production
COPY --from=dependencies --chown=bun:bun /app/node_modules ./node_modules
COPY --chown=bun:bun . .
USER bun
# `server-only` throws outside the react-server condition; the worker shares
# those server modules, so it resolves them the way Next.js does.
CMD ["bun", "--conditions=react-server", "scripts/run-worker.ts"]

FROM base AS runner
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=bun:bun /app/apps/web/.next/standalone ./
COPY --from=build --chown=bun:bun /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=bun:bun /app/apps/web/public ./apps/web/public
USER bun
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD ["bun", "-e", "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["bun", "apps/web/server.js"]

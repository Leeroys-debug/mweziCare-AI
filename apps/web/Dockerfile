# Multi-stage, multi-target Dockerfile for the whole runtime: the Next.js
# web app, the pg-boss worker, and a one-off migration runner, all built
# from one shared `source` stage so web/worker genuinely run from "the same
# image" (F2 spec) even though they end up as separate `docker build --target`
# outputs. Build from the MONOREPO ROOT, not this directory:
#
#   docker build -f apps/web/Dockerfile --target web    -t mwezicare-web    .
#   docker build -f apps/web/Dockerfile --target worker -t mwezicare-worker .
#   docker build -f apps/web/Dockerfile --target migrate -t mwezicare-migrate .
#
# [REVIEW REQUIRED] Written against this repo's actual package.json scripts
# and next.config.ts's `output: "standalone"` + `outputFileTracingRoot`, but
# not yet exercised with a live `docker build` (no Docker daemon in the
# environment this was built in) — see docs/deploy.md's verification note.

# ---- source: whole workspace, every dependency (dev + prod) installed ----
FROM node:20-bookworm-slim AS source
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile

# ---- build: Next.js standalone server bundle ----
FROM source AS build
# Dummy build-time values — `next build` type-checks and traces every route,
# but nothing in this app calls loadServerEnv() (the real, validated config)
# at build/module-eval time (see apps/web/lib/lazy.ts's doc comment), so
# these only need to exist, never be real.
ENV DATABASE_URL=postgres://user:pass@localhost:5432/db \
    AUTH_SECRET=build-time-placeholder-not-for-real-use-000000000 \
    AI_GATEWAY_API_KEY=placeholder \
    ENCRYPTION_KEYS={"1":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="} \
    ENCRYPTION_KEY_ID=1 \
    HMAC_LOOKUP_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= \
    ANALYTICS_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= \
    S3_ENDPOINT=http://localhost:9000 \
    S3_ACCESS_KEY=placeholder \
    S3_SECRET_KEY=placeholder \
    S3_BUCKET=placeholder
RUN pnpm --filter @mwezicare/web build

# ---- web: slim runtime, just the standalone bundle ----
FROM node:20-bookworm-slim AS web
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
# packages/assistant's safety/fixed-responses.ts reads content/{locale}/safety/*.md
# straight off disk at request time (defaultContentRoot() resolves to /app/content
# here) — Next.js's standalone trace only follows its own module graph, so this
# runtime-only file read is invisible to it and must be copied explicitly. Without
# it, the urgent/self-harm/out-of-scope/no-reliable-information fixed responses
# 500 instead of returning their safe fallback text.
COPY --from=build /app/content ./content
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

# ---- worker: pg-boss background jobs — needs tsx + the full workspace
# source (the standalone bundle above only contains the Next.js app) ----
FROM source AS worker
WORKDIR /app/apps/web
ENV NODE_ENV=production
CMD ["pnpm", "exec", "tsx", "worker/index.ts"]

# ---- migrate: one-off release step (run to completion, then exit) ----
FROM source AS migrate
WORKDIR /app/packages/db
ENV NODE_ENV=production
CMD ["pnpm", "exec", "tsx", "src/migrate.ts"]

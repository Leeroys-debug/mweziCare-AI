# Deployment (Phase F2)

Two documented targets: a **prototype** on Vercel (fast to stand up, synthetic data only — don't put
real user data on it) and a **pilot** on AWS ECS Fargate (the shape a real af-south-1 deployment would
take). Both assume `pnpm install` works locally and you've read `.env.example`.

## Health check

`GET /api/v1/health/status` (`apps/web/app/api/v1/health/status/route.ts`) checks Postgres connectivity
(`select 1`) and pg-boss queue status (oldest pending job age per queue), returning `200` when healthy
and `503` with the specific failing check named in the body otherwise. This is distinct from the older
`GET /api/v1/health` (an unrelated, pre-existing static `{status:"ok"}` route) — point load balancer
health checks and uptime monitors at `/status`, not the bare route.

**Uptime monitoring**: point an external monitor (UptimeRobot, Better Stack, Pingdom, or AWS Route53
health checks once a domain exists) at `/api/v1/health/status` on a 1–5 minute interval, alerting on two
consecutive failures. It deliberately doesn't check third-party dependencies (AI Gateway, Africa's
Talking) — those failing shouldn't page on-call for the whole app being down.

## Target A — Prototype (Vercel + Neon)

Synthetic data only — this target has no retention-job runtime (see below), no production SMS
credentials expected, and is meant for demos/review, not real users.

1. **Database**: create a [Neon](https://neon.tech) Postgres project (Neon supports the `postgis`,
   `vector`, and `pg_trgm` extensions; `pgcrypto` ships by default). Run `CREATE EXTENSION IF NOT EXISTS
postgis; CREATE EXTENSION IF NOT EXISTS vector; CREATE EXTENSION IF NOT EXISTS pg_trgm; CREATE
EXTENSION IF NOT EXISTS pgcrypto;` once, then `DATABASE_URL=<neon-connection-string> pnpm db:migrate`
   from `packages/db`.
2. **Object storage**: Neon has no S3-compatible storage — use a real S3 bucket (or keep Garage/MinIO
   self-hosted elsewhere) and point `S3_ENDPOINT`/`S3_ACCESS_KEY`/`S3_SECRET_KEY`/`S3_BUCKET` at it.
3. **Vercel project**: import the repo, set the root directory to `apps/web`, framework preset
   "Next.js". Add every variable from `.env.example` (except `NEXT_PUBLIC_APP_URL`, which Vercel sets
   per-deployment) as a Vercel environment variable — scope production-only secrets to the Production
   environment, not Preview.
4. **Worker jobs via Vercel Cron**: Vercel's serverless functions can't run a long-lived pg-boss worker
   process. Instead, add bearer-token-gated routes under `/api/internal/cron/*` that wrap the same job
   functions `apps/web/worker/jobs/*.ts` export (`runRetention`, `runAnalyticsRefresh`, etc.), and a
   `vercel.json` `crons` entry per job on the schedule `worker/index.ts` already uses (retention nightly
   at 04:00, analytics refresh at 02:00, facilities import weekly). **[REVIEW REQUIRED]**: these
   `/api/internal/cron/*` routes don't exist yet — this is the one piece of real work this target still
   needs before it's usable, since the worker process itself (`apps/web/worker/index.ts`) only runs via
   `pnpm worker` on a long-lived host, which Vercel doesn't provide.
5. Deploy. First deploy to `main` is "staging"; promote by pointing a second Vercel project (or a
   Vercel Git branch deployment) at a tagged release for "production", gated by Vercel's own deployment
   protection / manual promotion.

Rough time for a new developer with Neon + Vercel accounts already created: **well under an hour** —
steps 1–3 are mostly clicking through each service's UI; step 4 only matters once retention/analytics
jobs are needed, not for a first deploy.

## Target B — Pilot (AWS ECS Fargate, af-south-1)

The shape a real pilot deployment takes: ALB → ECS Fargate (`web` + `worker` services, same container
image) → RDS PostgreSQL Multi-AZ, S3 for PDFs, KMS for keys, Secrets Manager for everything else. Provisioned by
`infra/terraform/` (Terraform, parameterised by `var.aws_region` so counsel can require hosting outside
af-south-1 without touching any other file) — see that directory's own `README.md` for the full
resource list and **[REVIEW REQUIRED]** items (PostGIS/pgvector-on-RDS not yet confirmed, no ACM
certificate/domain yet, Fargate sizing unreviewed by ops). **This target has not been exercised against
a real AWS account or a live Docker daemon** — both were unavailable in the environment this was built
in. Treat it as a reviewed starting point, not an apply-ready stack.

1. **Build images**: from the repo root (not `apps/web/`, since the Dockerfile reaches into
   `packages/*`):
   ```bash
   docker build -f apps/web/Dockerfile --target web    -t <ecr-web-repo>:<tag>    .
   docker build -f apps/web/Dockerfile --target worker -t <ecr-worker-repo>:<tag> .
   ```
2. **Provision AWS resources**: `cd infra/terraform && terraform init && terraform plan -var="web_image=..." -var="worker_image=..."` — review the plan, then `terraform apply` only with explicit sign-off (real, billable resources).
3. **Populate secrets**: the Terraform output `app_secrets_arn` names a Secrets Manager secret Terraform
   deliberately leaves empty — populate its JSON value with `AUTH_SECRET`, `AFRICASTALKING_USERNAME`,
   `AFRICASTALKING_API_KEY`, `AFRICASTALKING_SENDER_ID`, `AI_GATEWAY_API_KEY`, `ENCRYPTION_KEYS`,
   `ENCRYPTION_KEY_ID`, `HMAC_LOOKUP_KEY`, `ANALYTICS_KEY`, `SENTRY_DSN` via the AWS console or
   `aws secretsmanager put-secret-value` — never via Terraform (state/plan output must never contain
   real secrets).
4. **Push images**: `docker push` both to the ECR repos Terraform created (output `ecr_web_repository_url`/`ecr_worker_repository_url`).
5. **Migrate, then start**: run the `migrate` task definition to completion (`aws ecs run-task
--task-definition <name_prefix>-migrate ...`) _before_ the `web`/`worker` services pick up the new
   image — see `infra/terraform/README.md`'s release-flow section. This is the "migrations run as a
   separate release step" requirement.
6. **DNS**: point a domain at the Terraform output `alb_dns_name` (CNAME) once one is chosen; add an
   ACM certificate + HTTPS listener (`infra/terraform/alb.tf`'s `[REVIEW REQUIRED]` note) before
   treating this as internet-facing for real users.

### Local verification of the same images

`docker compose -f docker-compose.prod.yml up` runs the equivalent stack locally (web + worker +
Postgres + Garage) against disposable local secrets you supply as environment variables — see that
file's required `${VAR:?...}` substitutions. Not yet run end-to-end in this environment (no Docker
daemon available); `next build` and a `tsx worker/index.ts` smoke test were run directly instead and
both succeeded (see `docs/security.md`'s "Known gaps" entry).

## Staging vs. production

- **Staging** auto-deploys from every push to `main` (Vercel: default Git integration behavior: a Vercel
  branch deployment tracking `main`; AWS: a GitHub Actions job triggered on push to `main` that runs
  steps 1/4/5 above against the staging Terraform workspace/state).
- **Production** deploys only from a tagged release (e.g. `v1.2.0`), with a manual approval gate before
  the deploy job runs — GitHub Actions' `environment:` protection rules (requiring a reviewer) are the
  natural mechanism for this; `.github/workflows/ci.yml` doesn't include a deploy job yet (CI only lints,
  type-checks, tests, and runs e2e — deploy workflows are a separate, environment-specific addition once
  real Vercel/AWS credentials exist to wire them to).

## Secrets reference

Every environment variable this app reads is documented in `.env.example` and `docs/security.md`. The
short version: `ENCRYPTION_KEYS`/`HMAC_LOOKUP_KEY`/`ANALYTICS_KEY`/`AUTH_SECRET` must be freshly
generated per environment (`openssl rand -base64 32`) and never reused between staging and production.

# CLAUDE.md

## Product

MweziCare AI is a mobile-first menstrual health companion for girls and young women in Kenya. It supports
symptom tracking, clinically reviewed triage, an education assistant, verified facility navigation, a
shareable clinician summary, and an aggregated impact dashboard. **It never diagnoses endometriosis or any
other condition** — only early recognition, risk-informed next steps, and connection to qualified care.

## Stack

- pnpm + Turborepo monorepo
- `apps/web`: Next.js (App Router), React 19, TypeScript strict
- Tailwind CSS + shadcn/ui (Radix primitives)
- React Hook Form + Zod
- TanStack Query
- next-intl (`en`, `sw`)
- Offline: Serwist (service worker) + Dexie (IndexedDB)
- Drizzle ORM + drizzle-kit
- PostgreSQL 16 with PostGIS, pgvector, pgcrypto
- Better Auth (email + password, sessions in Postgres)
- pg-boss (Postgres-backed background jobs)
- Vercel AI SDK for the conversational assistant (streaming chat)
- @react-pdf/renderer (clinician summary PDFs)
- Recharts (impact dashboard)
- Vitest, Testing Library, Playwright

## Repo layout

```
mwezicare/
├─ apps/
│  └─ web/                      # Next.js app (PWA + API + admin)
│     ├─ app/
│     │  ├─ [locale]/
│     │  │  ├─ (public)/        # landing, learn, privacy, sign-in
│     │  │  ├─ (user)/          # tracker, insights, assistant, care, summary
│     │  │  └─ (staff)/         # clinician review, facility verification, dashboard
│     │  ├─ api/v1/             # REST route handlers
│     │  └─ s/[token]/          # clinician summary share link
│     ├─ components/
│     ├─ lib/                   # auth, db client, i18n, logging
│     └─ worker/                # pg-boss job handlers (same image, separate process)
├─ packages/
│  ├─ db/                       # Drizzle schema, migrations, seed
│  ├─ rules-engine/             # rule DSL, evaluator, rule tests
│  ├─ triage/                   # pattern features over cycles + symptoms
│  ├─ assistant/                # RAG retrieval, prompts, safety filters
│  ├─ facilities/               # KMHFL importer, geo search
│  ├─ validation/                # shared Zod schemas
│  └─ ui/                       # shared components
└─ content/                     # clinician-approved articles (EN/SW, Markdown)
```

## Commands

| Task                 | Command                       |
| -------------------- | ----------------------------- |
| Install deps         | `pnpm install`                |
| Dev server           | `pnpm dev`                    |
| Start local Postgres | `pnpm db:up` (docker compose) |
| Run migrations       | `pnpm db:migrate`             |
| Seed synthetic data  | `pnpm db:seed`                |
| Lint                 | `pnpm lint`                   |
| Typecheck            | `pnpm typecheck`              |
| Unit/component tests | `pnpm test`                   |
| End-to-end tests     | `pnpm test:e2e`               |
| Build                | `pnpm build`                  |

## Coding conventions

- TypeScript strict everywhere; no `any`.
- Validation schemas live in `packages/validation` and are shared by client and server — one Zod schema
  validates a form and its API route.
- REST endpoints live under `/api/v1`; errors follow RFC 9457 problem-details format.
- Business logic belongs in `packages/*` (rules-engine, triage, assistant, facilities), never inline in
  route handlers — handlers call package functions and stay thin.
- React Server Components by default; add `'use client'` only when the component needs interactivity,
  browser APIs, or local state.
- Every user-facing string goes through `next-intl` — no hardcoded copy in components. `en` and `sw`
  message files are updated together.
- Components must meet WCAG 2.2 AA: large touch targets, readable at 200% zoom, keyboard navigable.

## Non-negotiable safety and privacy rules

These override convenience or speed in every session. If a task seems to require breaking one, stop and
flag it instead.

- **No clinical content as final.** Never write triage rules, thresholds, escalation reasons, or education
  articles as if clinically approved. Mark every placeholder `[CLINICAL REVIEW REQUIRED]` until a named
  clinician has signed off.
- **Rules engine decides urgency, not the LLM.** Urgency (`routine` / `assess_soon` / `urgent`) is decided
  only by the deterministic, versioned rules engine (`packages/rules-engine`, `packages/triage`). The
  conversational assistant never makes, overrides, or softens a triage decision.
- **No diagnostic language.** Never produce UI copy, assistant output, or docs that state or imply a user
  "has" a condition (e.g. "you have endometriosis"), and never surface unvalidated probabilities or
  confidence scores to users.
- **No sensitive data in logs, seeds, or third parties.** Never log, seed, or transmit externally: names,
  phone numbers, emails, precise location, symptom content, or chat text. Scrub these fields from
  application logs and error reports (Sentry) before they're written.
- **Location is ephemeral.** Used only for the specific facility-search request; never persisted, never
  sent to analytics.
- **Per-user data scoping + audit.** Every query touching health data (`symptom_logs`, `assessments`,
  `chat_sessions`, `summaries`, etc.) is scoped to the authenticated session user. Staff access to any
  user's health data is role-checked inside the handler (not just in middleware) and written to
  `audit.access_log`.
- **Synthetic data only.** Seeds, fixtures, and tests use fabricated data — never real user data, even in
  local dev.

## Definition of done

A task is done only when:

- `pnpm lint`, `pnpm typecheck`, and `pnpm test` all pass.
- New business logic (rules, triage features, API handlers) has unit tests.
- Any new or changed user-facing string exists in both `en` and `sw` message files.
- No secrets, API keys, or credentials are committed.

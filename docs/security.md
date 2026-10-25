# Security (Phase F1)

Written for a DPIA/pentest reviewer. Describes what's implemented, where, and what still needs
sign-off before this app handles real user data. Cross-reference `docs/data-inventory.md` for what's
stored and `CLAUDE.md` for the non-negotiable product rules this all exists to enforce.

## HTTP security headers

Set on every response (page and API) by `apps/web/proxy.ts` / `apps/web/lib/security-headers.ts`:

| Header                      | Value                                                                                                                                                                                                                        | Why                                                      |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `Content-Security-Policy`   | `script-src 'self' 'nonce-<random>' 'strict-dynamic'`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, plus `img-src`/`connect-src`/`worker-src` allowances for maplibre-gl (Care tab's map) and OSM tiles | Mitigates XSS; a fresh nonce is generated per request    |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` (production only)                                                                                                                                                             | Forces HTTPS                                             |
| `X-Content-Type-Options`    | `nosniff`                                                                                                                                                                                                                    | Blocks MIME-sniffing                                     |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`                                                                                                                                                                                            | Limits what leaks via the Referer header                 |
| `Permissions-Policy`        | `geolocation=(self)`, camera/microphone/payment denied                                                                                                                                                                       | Only the Care tab's facility search may request location |
| `X-Frame-Options`           | `DENY`                                                                                                                                                                                                                       | Defense-in-depth alongside `frame-ancestors`             |

`/s/:path*` (the public clinician-summary share link) additionally sets `X-Robots-Tag: noindex,
nofollow` and `Referrer-Policy: no-referrer` (`next.config.ts`) — a share link token must never leak
via a search engine or a referred third-party request.

**[REVIEW REQUIRED]** This hasn't been exercised against a live browser session — verify no CSP
console violations on every page (especially the Care map and the chat SSE stream) before relying on
it in production.

## CSRF protection

No Server Actions exist — every mutation is a Route Handler, so the defense is an Origin/Referer check:
`apps/web/lib/csrf.ts`'s `assertSameOrigin(request)` compares the `Origin` header (falling back to
`Referer`) against `NEXT_PUBLIC_APP_URL`'s origin, rejecting with `403` on any mismatch or absence.
Called at the top of every cookie-authenticated POST/PUT/DELETE/PATCH handler, before any body
parsing or database access. Better Auth's own `/api/auth/sign-in/email` and `/api/auth/sign-up/email`
endpoints don't call it — they're the login flow itself, not a cookie-authenticated action.

Session cookies are explicitly `SameSite=Lax` (`apps/web/lib/auth.ts`'s `advanced.defaultCookieAttributes`
— matches Better Auth's own default, made explicit so a future SDK default change can't silently
widen it).

## Input validation and error handling

Every route handler validates its input with a Zod schema (`packages/validation`) via `safeParse`
before touching the database, returning an RFC 9457 problem-details response (`apps/web/lib/
problem-details.ts`) on failure. Audited across every handler in `app/api/v1/**` (F1): no gaps found.

The only handler with a real `catch (error)` around something that can throw an unexpected
exception (`/api/v1/chat`'s pipeline) logs the
raw error server-side and returns a fixed, generic message to the client — never `error.stack` or
`error.message`. No route anywhere serializes a caught exception directly into a response. An
uncaught exception that bypasses these fails through to Next.js's own production error handling,
which doesn't leak stack traces either.

## Observability

- **Sentry** (`@sentry/nextjs`, `apps/web/sentry.server.config.ts` / `instrumentation-client.ts`) is a
  no-op unless `SENTRY_DSN` (`NEXT_PUBLIC_SENTRY_DSN` client-side) is set. Its `beforeSend`
  (`apps/web/lib/sentry-scrub.ts`) drops the request body, cookies, headers, and query string outright,
  then redacts any key matching `phone`/`email`/`notes`/`content`/`lat`/`lng` anywhere in the event
  (user context, extra, tags, contexts) as a second layer. No session-replay integration — it
  screenshots the DOM, which on `/track`/`/insights` would capture symptom data. Performance tracing is
  off by default (`SENTRY_TRACES_SAMPLE_RATE=0`).
- **pino** (`apps/web/lib/logger.ts`) is used at new/sensitive log sites (the chat
  pipeline, the retention job) — not a rewrite of every existing `console.log`. Its `redact` config
  matches the same field list at any nesting depth.
- Neither can fully prevent a raw phone number embedded inside a third-party library's own error
  _message string_ (as opposed to a structured field) from reaching a log/Sentry event — that's a
  residual risk inherent to key-based redaction, not something either tool can close completely.

## Rate limits

Postgres-backed token bucket (`packages/db`'s `consumeRateLimitToken`, `identity.rate_limit_buckets`):

| Endpoint                        | Scope       | Capacity | Refill  |
| ------------------------------- | ----------- | -------- | ------- |
| `POST /api/v1/chat`             | per user    | 20       | /hour   |
| `POST /api/v1/analytics`        | per user    | 60       | /hour   |
| `GET /s/[token]` (summary view) | per IP hash | 20       | /10 min |
| `POST /api/v1/assessments`      | per user    | 30       | /hour   |
| `GET /api/v1/facilities/search` | per user    | 60       | /hour   |

Rate limiting is always checked _after_ input validation (so a malformed request 400s without a
database round-trip), consistent across every route above.

## Retention jobs

`apps/web/worker/jobs/retention.ts`, one pg-boss job (`retention.purge`) run nightly at 04:00
Africa/Nairobi, four independent sweeps:

| Data                                                                   | Env var                     | Default | **[LEGAL REVIEW REQUIRED]**              |
| ---------------------------------------------------------------------- | --------------------------- | ------- | ---------------------------------------- |
| `health.chat_messages` older than N days                               | `CHAT_RETENTION_DAYS`       | 90      | Placeholder period, not counsel-approved |
| `health.summaries` (+ their PDFs) expired/revoked more than N days ago | `SHARE_LINK_RETENTION_DAYS` | 7       | Placeholder                              |
| `identity.users` whose deletion was requested more than N days ago     | `ACCOUNT_PURGE_DAYS`        | 30      | Placeholder                              |
| `audit.access_log` older than N days                                   | `AUDIT_RETENTION_DAYS`      | 365     | Placeholder                              |

`DELETE /api/v1/me` no longer deletes immediately — it sets `identity.users.deletion_requested_at` and
signs the user out; the retention job does the real purge (`DELETE FROM identity.users`, which cascades
to every user-scoped table — see `docs/data-inventory.md`). Summary PDFs are deleted from object
storage explicitly by the job (`lib/object-storage.ts`'s `deleteObject`), not left solely to the
bucket's own hardcoded 7-day lifecycle rule, since that rule doesn't know about
`SHARE_LINK_RETENTION_DAYS`.

Tested with Vitest fake timers (`worker/jobs/retention.test.ts`): seeds rows at known ages relative to
a fixed "now", asserts only the rows past each window are deleted.

## Encryption and key rotation

AES-256-GCM field-level encryption (`packages/db/src/crypto.ts`) for
`health.symptom_logs.notes_enc`, `health.chat_messages.content_enc`. Packed ciphertext format is
`keyId.iv.tag.ciphertext` (legacy 3-segment `iv.tag.ciphertext` values, written before key ids existed,
still decrypt against the provider's current key).

- `ENCRYPTION_KEYS` — JSON object of `keyId -> base64 32-byte key` (e.g. `{"1":"<base64>"}`).
- `ENCRYPTION_KEY_ID` — which entry is current; used for all new encryptions.
- **Rotation procedure**: generate a new key, add it to `ENCRYPTION_KEYS` under a new id, point
  `ENCRYPTION_KEY_ID` at it, deploy, then run `pnpm --filter @mwezicare/web run reencrypt`
  (`worker/jobs/reencrypt.ts`) — a one-off, idempotent job that re-writes every encrypted field under
  the new key. Once it reports zero rows left on the old id, that id can be dropped from
  `ENCRYPTION_KEYS`.
- `hmacLookup` (share-link token hashes, analytics pseudo-ids) and `sha256Hex` are **not** subject to
  rotation — HMAC_LOOKUP_KEY/ANALYTICS_KEY are single, fixed keys. Rotating a lookup key would silently
  break every existing equality match.

## Supply chain

- `.github/dependabot.yml` — weekly updates for npm (grouped minor/patch) and GitHub Actions.
- `.github/workflows/codeql.yml` — `javascript-typescript` analysis on every PR, push to `main`, and
  weekly.
- `.gitleaks.toml` — extends gitleaks' default ruleset; allowlists `.env.example` (blank placeholders)
  and `.github/workflows/lighthouse.yml` (hardcoded, clearly-labeled disposable keys for an ephemeral
  CI-only Postgres). The actual CI step is wired into `.github/workflows/ci.yml` (F2).
- `pnpm audit --audit-level=high`: fixed by upgrading `vitest` (2→4), `maplibre-gl` (4→6), `drizzle-orm`
  (0.38→0.45), and `@testcontainers/postgresql` (10→12), plus two targeted `pnpm-workspace.yaml`
  overrides (`tmp`, `basic-ftp`) for transitive deps of Lighthouse CI's tooling that hadn't bumped their
  own ranges yet. **Residual, accepted**: `extract-zip` (×2 advisories, via `@lhci/cli`→puppeteer-core's
  own Chromium-download extraction) and `braces` (via `lint-staged`/`eslint-config-next`'s glob
  matching) have **no patched version published upstream** — both are dev-only tooling that never ships
  to production and never processes untrusted input (puppeteer-core only extracts its own official
  Chromium zip; the glob matchers only run against this repo's own trusted file paths during
  lint/pre-commit). Re-check at the next Dependabot/CodeQL cycle in case a fix lands.

## Known gaps / review items

- Guardian-consent flow for under-18 users doesn't exist yet — onboarding blocks that age band outright
  (`apps/web/app/api/v1/me/profile/route.ts`).
- CSP/header behavior hasn't been verified against a live browser (no Docker in the environment this
  phase was built in).
- `audit.access_log.actor_id` has no `ON DELETE CASCADE`/`SET NULL` — if a staff account that has ever
  appeared as an actor in the audit log requests its own deletion, the retention job's purge would fail
  on that foreign key. Pre-existing behavior (the original immediate-delete `DELETE /api/v1/me` had the
  same gap); not addressed here since it needs a deliberate decision (cascade vs. anonymize vs. block)
  rather than a mechanical fix.
- `infra/garage/garage.toml`'s `rpc_secret` and `admin_token` are committed, dev-shaped placeholder
  values, reused as-is by `docker-compose.prod.yml` (F2) — rotate both before any real deployment.
  Low exploitability as long as Garage's admin API (port 3903) stays unpublished, as it is in both
  compose files, but they're still public in this repo's history.
- `docker-compose.prod.yml` and the Dockerfile (F2) have been verified via a real local `next build`
  and a `tsx worker/index.ts` smoke test, but not a live `docker build`/`docker compose up` (no Docker
  daemon in the environment this was built in) — see `docs/deploy.md`'s verification note.

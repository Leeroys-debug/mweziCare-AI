import { z } from "zod";

/**
 * Server-only environment variables. Import this only from server code
 * (route handlers, server components, the worker) — never from a
 * 'use client' module, since it may read secrets.
 */
export const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  DATABASE_URL: z.string().url(),

  AUTH_SECRET: z.string().min(32),

  // Vercel AI Gateway — the conversational assistant (packages/assistant)
  // uses plain "provider/model" strings (e.g. "openai/gpt-4o-mini") so the
  // model/provider is swappable via env, never code (CLAUDE.md "Vercel AI
  // SDK for the conversational assistant").
  AI_GATEWAY_API_KEY: z.string().min(1),
  ASSISTANT_CHAT_MODEL: z.string().min(1).default("openai/gpt-4o-mini"),
  ASSISTANT_EMBEDDING_MODEL: z
    .string()
    .min(1)
    .default("openai/text-embedding-3-small"),
  // Optional: when set, embeddings (query- and ingest-time) go straight to
  // Google's Generative AI API instead of through AI Gateway — Gateway has
  // no free-tier embedding model, Google's does. Chat generation still goes
  // through AI Gateway/ASSISTANT_CHAT_MODEL either way.
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1).optional(),

  // Demo/dev-only escape hatch: when set, the Ask tab's retrieval also
  // considers status:"draft" kb_documents (never on by default — CLAUDE.md
  // bars unreviewed clinical content from shipping as final). Every source
  // chip and Learn page already renders a visible DRAFT badge regardless of
  // this flag (see apps/web/components/assistant/source-chips.tsx and
  // app/[locale]/(public)/learn/[slug]/page.tsx) — this only controls
  // whether draft articles are retrievable at all. Mirrors kb/ingest.ts's
  // own ASSISTANT_INCLUDE_DRAFTS flag for seeding drafts into the DB.
  ASSISTANT_INCLUDE_DRAFTS: z
    .string()
    .optional()
    .transform((v) => v === "1"),

  // Envelope-encryption keys for field-level encryption (packages/db/crypto),
  // supporting key rotation (F1 spec): a JSON object of keyId -> base64
  // 32-byte key (e.g. {"1":"<base64>"}), kept small — only the key(s) a
  // still-live ciphertext could be tagged with need to stay here.
  // ENCRYPTION_KEY_ID names which entry is CURRENT (used for new
  // encryptions); older ids stay in the map purely so existing ciphertext
  // keeps decrypting until worker/jobs/reencrypt.ts re-writes it under the
  // new key, after which the old id can be dropped from this map entirely.
  ENCRYPTION_KEYS: z
    .string()
    .min(1)
    .transform((raw, ctx) => {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (
          typeof parsed !== "object" ||
          parsed === null ||
          Array.isArray(parsed)
        ) {
          throw new Error("not an object");
        }
        return parsed as Record<string, string>;
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'ENCRYPTION_KEYS must be a JSON object of keyId -> base64 key, e.g. {"1":"<base64>"}',
        });
        return z.NEVER;
      }
    }),
  ENCRYPTION_KEY_ID: z.string().min(1),
  HMAC_LOOKUP_KEY: z.string().min(1),
  // Separate keyed-hash key for analytics.events.pseudo_id — must not reuse
  // HMAC_LOOKUP_KEY, so analytics pseudonyms and phone/email lookup hashes
  // can never be correlated via a shared key. Generate with: openssl rand -base64 32
  ANALYTICS_KEY: z.string().min(1),

  SENTRY_DSN: z.string().url().optional(),
  SENTRY_ENVIRONMENT: z.string().min(1).optional(),
  // Performance tracing is OFF by default (0) — this app's spans/breadcrumbs
  // can carry request context, and CLAUDE.md bars health data from leaving
  // for a third party, so tracing is opt-in per environment, not default-on.
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0),

  // KMHFL API adapter (packages/facilities) — optional: only needed when
  // actually running the API-backed import (vs. the CSV/GeoJSON file adapter).
  KMHFL_API_BASE_URL: z.string().url().optional(),
  KMHFL_API_KEY: z.string().min(1).optional(),

  // S3-compatible object storage for clinician-summary PDFs (Garage/MinIO in
  // dev, real S3 on the AWS/Docker deployment). Required there, but NOT on
  // Vercel, which has no generic S3 endpoint — it uses Vercel Blob via
  // BLOB_READ_WRITE_TOKEN (auto-injected by the platform) instead; see
  // apps/web/lib/object-storage.ts's VERCEL branch. loadServerEnv() below
  // relaxes these to optional when process.env.VERCEL is set.
  S3_ENDPOINT: z.string().url(),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_REGION: z.string().min(1).default("us-east-1"),

  // Retention job (apps/web/worker/jobs/retention.ts), F1 spec. Every
  // default below is [LEGAL REVIEW REQUIRED] — these are placeholder
  // periods, not counsel-approved retention schedules.
  CHAT_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
  SHARE_LINK_RETENTION_DAYS: z.coerce.number().int().positive().default(7),
  ACCOUNT_PURGE_DAYS: z.coerce.number().int().positive().default(30),
  AUDIT_RETENTION_DAYS: z.coerce.number().int().positive().default(365),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Client-safe environment variables (must be prefixed NEXT_PUBLIC_). */
export const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  // Same project as SENTRY_DSN, duplicated under NEXT_PUBLIC_ so the browser
  // bundle can read it — Sentry DSNs are not secret (write-only ingest key).
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_ENVIRONMENT: z.string().min(1).optional(),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

let cachedServerEnv: ServerEnv | undefined;

/**
 * Validates process.env against serverEnvSchema and throws with a readable
 * message if anything is missing — call once at server startup so a bad
 * deploy fails fast instead of surfacing as a runtime data bug.
 */
export function loadServerEnv(
  source: NodeJS.ProcessEnv = process.env,
): ServerEnv {
  if (cachedServerEnv) return cachedServerEnv;

  // Treat "set but empty" the same as "unset" so optional vars left blank
  // in .env (SENTRY_DSN=, AFRICASTALKING_SENDER_ID=) don't fail validation.
  const sanitized = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== ""),
  );

  // On Vercel, object storage is Vercel Blob (BLOB_READ_WRITE_TOKEN), not
  // the generic S3 vars below — relax those from required to optional so
  // a Vercel deploy doesn't fail boot over env vars it will never read.
  const schema = sanitized.VERCEL
    ? serverEnvSchema.extend({
        S3_ENDPOINT: z.string().url().optional(),
        S3_ACCESS_KEY: z.string().min(1).optional(),
        S3_SECRET_KEY: z.string().min(1).optional(),
        S3_BUCKET: z.string().min(1).optional(),
      })
    : serverEnvSchema;

  const parsed = schema.safeParse(sanitized);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }

  // On Vercel the S3_* fields are genuinely absent (optional in `schema`
  // above), but object-storage.ts's VERCEL branch never reads them — this
  // cast only widens back to the base (non-Vercel) required shape.
  cachedServerEnv = parsed.data as ServerEnv;
  return cachedServerEnv;
}

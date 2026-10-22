import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  integer,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { identitySchema } from "./schemas";
import { roleEnum, consentPurposeEnum } from "./enums";

/**
 * Better Auth's phone-number plugin owns `phone_number`/`phone_number_verified`
 * (and the base `email`/`email_verified`/`name`/`image` columns it requires
 * even for phone-only auth — see apps/web/lib/auth.ts). Per CLAUDE.md's "no
 * plaintext phone numbers" rule, `phone_number` is never the raw number: our
 * auth routes pass it the HMAC lookup hash (packages/db/crypto hmacLookup),
 * and `email` holds a generated non-routable placeholder
 * (`<hash>@phone.mwezicare.invalid`), never a real address. The actual
 * phone number lives only in `phone_enc` (AES-256-GCM, packages/db/crypto).
 */
export const users = identitySchema.table(
  "users",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    phoneNumber: text("phone_number").notNull(),
    phoneNumberVerified: boolean("phone_number_verified")
      .notNull()
      .default(false),
    phoneEnc: text("phone_enc"),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    name: text("name").notNull().default(""),
    image: text("image"),
    role: roleEnum("role").notNull().default("user"),
    locale: text("locale").notNull().default("en"),
    // Set by DELETE /api/v1/me (sign-out + mark, not an immediate delete) —
    // the retention job purges the account ACCOUNT_PURGE_DAYS after this is
    // set (F1 spec's 30-day grace window), not on request.
    deletionRequestedAt: timestamp("deletion_requested_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("users_phone_number_idx").on(table.phoneNumber),
    uniqueIndex("users_email_idx").on(table.email),
  ],
);

/** Age band, not date of birth — data minimisation (see architecture doc). */
export const profiles = identitySchema.table("profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  ageBand: text("age_band").notNull(),
  county: text("county"),
  consentVersion: integer("consent_version").notNull().default(1),
  // [LEGAL REVIEW REQUIRED] guardian-consent flow for under-18 users — see
  // CLAUDE.md and the "Compliance items to confirm with counsel" section.
  guardianConsentRef: text("guardian_consent_ref"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** One row per purpose: tracking, location, research, sharing. */
export const consents = identitySchema.table(
  "consents",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: consentPurposeEnum("purpose").notNull(),
    version: integer("version").notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true }),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("consents_user_purpose_version_idx").on(
      table.userId,
      table.purpose,
      table.version,
    ),
  ],
);

/**
 * Postgres-backed token bucket for OTP request rate limiting — one row per
 * key (e.g. `otp:phone:<hash>` or `otp:ip:<hash>`). See packages/db's
 * consumeRateLimitToken() helper, used for both the per-phone-hash and
 * per-IP dimensions required by CLAUDE.md / the architecture doc.
 */
export const rateLimitBuckets = identitySchema.table("rate_limit_buckets", {
  key: text("key").primaryKey(),
  tokens: doublePrecision("tokens").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- Better Auth (phone OTP) ------------------------------------------
// Drizzle-adapter-shaped tables for Better Auth's core "session", "account"
// and "verification" models (apps/web/lib/auth.ts, provider: "pg",
// usePlural: true). IDs are UUIDs — see `advanced.database.generateId` in
// auth.ts, which keeps them consistent with every other table's uuid PKs.

export const sessions = identitySchema.table(
  "sessions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    // OTP-authenticated sessions expire after 30 days idle (CLAUDE.md).
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("sessions_token_idx").on(table.token)],
);

export const accounts = identitySchema.table("accounts", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
    withTimezone: true,
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * OTP codes — expire 5 minutes after issue (CLAUDE.md / architecture doc).
 * `identifier` is the same opaque phone hash used for `users.phone_number`,
 * never the raw phone number.
 */
export const verifications = identitySchema.table("verifications", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

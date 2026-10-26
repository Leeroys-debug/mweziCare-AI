import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { healthSchema } from "./schemas";
import {
  bleedingLevelEnum,
  escalationVerdictEnum,
  quizPromptKindEnum,
  triageOutcomeEnum,
} from "./enums";
import { users } from "./identity";
import { rulesets } from "./clinical";

/** Derived from period-day logs. */
export const cycles = healthSchema.table("cycles", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  predicted: boolean("predicted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** client_id makes offline sync idempotent (see CLAUDE.md offline rules). */
export const symptomLogs = healthSchema.table(
  "symptom_logs",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    logDate: date("log_date").notNull(),
    periodDay: boolean("period_day").notNull().default(false),
    bleedingLevel: bleedingLevelEnum("bleeding_level"),
    painScore: integer("pain_score"),
    painLocations: text("pain_locations").array(),
    // Capture-only context (never read by packages/rules-engine or
    // packages/triage) — see packages/validation's painTimingSchema.
    painTiming: text("pain_timing").array(),
    painPersistsDespiteRelief: boolean("pain_persists_despite_relief"),
    symptoms: jsonb("symptoms"),
    impact: jsonb("impact"),
    redFlags: jsonb("red_flags"),
    // Encrypted (AES-256-GCM, packages/db/crypto) — same pattern as
    // health.chat_messages.content_enc. Never logged or sent to analytics.
    notesEnc: text("notes_enc"),
    clientId: text("client_id").notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Idempotency key for offline sync (ON CONFLICT target) — not a
    // one-log-per-day constraint, since a day's log can be amended with a
    // new client_id; last-write-wins reconciliation happens in the app.
    uniqueIndex("symptom_logs_user_log_date_client_idx").on(
      table.userId,
      table.logDate,
      table.clientId,
    ),
    // Plain (non-unique) index for date-range queries, e.g. GET /logs?from=&to=
    index("symptom_logs_user_log_date_idx").on(table.userId, table.logDate),
    check(
      "symptom_logs_pain_score_range",
      sql`${table.painScore} is null or ${table.painScore} between 0 and 10`,
    ),
  ],
);

/** Immutable audit record of every triage recommendation. */
export const assessments = healthSchema.table("assessments", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  rulesetVersion: integer("ruleset_version")
    .notNull()
    .references(() => rulesets.version),
  outcome: triageOutcomeEnum("outcome").notNull(),
  reasons: jsonb("reasons").notNull(),
  /** Rule codes (clinical.rules.code) that fired — for the staff flagged-case-samples review. */
  firedRuleCodes: text("fired_rule_codes").array(),
  /** The flat feature record evaluate() was run against — same, for quality review. */
  features: jsonb("features"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Clinician adjudication of an assess_soon/urgent assessment's
 * appropriateness, for the "safety of urgent escalations" pilot metric
 * (UNICEF Femtech proposal §10). Deliberately a separate append-only table
 * rather than a column on `assessments` — that table is documented and
 * RLS-protected as an immutable audit record; a review is a distinct event
 * that references it, and a clinician can review the same assessment more
 * than once if needed (the staff console reads the latest row per
 * assessment). No RLS of its own: it carries no symptom content, only an
 * opaque assessment id and a verdict, and access is role-checked in the
 * API handler (clinician-only) per CLAUDE.md.
 */
export const assessmentReviews = healthSchema.table(
  "assessment_reviews",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    reviewedBy: uuid("reviewed_by")
      .notNull()
      .references(() => users.id),
    verdict: escalationVerdictEnum("verdict").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("assessment_reviews_assessment_idx").on(table.assessmentId),
  ],
);

export const chatSessions = healthSchema.table("chat_sessions", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Content encrypted; auto-deleted per retention policy (CLAUDE.md). */
export const chatMessages = healthSchema.table(
  "chat_messages",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    contentEnc: text("content_enc").notNull(),
    safetyFlags: jsonb("safety_flags"),
    sources: text("sources").array(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("chat_messages_session_idx").on(table.sessionId)],
);

/** Share link expires 72 hours after creation by default (app-set). */
export const summaries = healthSchema.table(
  "summaries",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    period: text("period").notNull(),
    pdfKey: text("pdf_key").notNull(),
    shareTokenHash: text("share_token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    viewCount: integer("view_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("summaries_share_token_hash_idx").on(table.shareTokenHash),
  ],
);

/**
 * [CLINICAL REVIEW REQUIRED] A short knowledge-check quiz taken once at
 * onboarding and again ~30 days later, to measure knowledge change
 * (analytics.mv_knowledge_score_change). Questions/copy live in
 * messages/{en,sw}.json, not here — this table only stores the outcome.
 */
export const quizAttempts = healthSchema.table(
  "quiz_attempts",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    promptKind: quizPromptKindEnum("prompt_kind").notNull(),
    score: integer("score").notNull(),
    totalQuestions: integer("total_questions").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // One attempt per prompt kind per user — a user can't re-take "onboarding" or "day30" twice.
    uniqueIndex("quiz_attempts_user_prompt_kind_idx").on(
      table.userId,
      table.promptKind,
    ),
  ],
);

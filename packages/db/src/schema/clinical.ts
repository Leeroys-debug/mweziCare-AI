import { sql } from "drizzle-orm";
import {
  date,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { clinicalSchema } from "./schemas";
import { kbStatusEnum, rulesetStatusEnum, triageOutcomeEnum } from "./enums";
import { users } from "./identity";
import { vector1536 } from "./custom-types";

/** Only one approved version is live — packages/rules-engine enforces this. */
export const rulesets = clinicalSchema.table("rulesets", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  version: integer("version").notNull().unique(),
  status: rulesetStatusEnum("status").notNull().default("draft"),
  approvedBy: uuid("approved_by").references(() => users.id),
  /** The clinician's typed attestation at approval time (staff console) — a plain-text audit trail. */
  approvedByName: text("approved_by_name"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * [CLINICAL REVIEW REQUIRED] Individual rule definitions within a ruleset.
 * `definition` is the condition/threshold logic (packages/rules-engine
 * evaluator shape); `reasonEn`/`reasonSw` are the clinician-written,
 * user-facing explanations shown when a rule fires.
 */
export const rules = clinicalSchema.table(
  "rules",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    rulesetId: uuid("ruleset_id")
      .notNull()
      .references(() => rulesets.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    priority: integer("priority").notNull().default(0),
    outcome: triageOutcomeEnum("outcome").notNull(),
    /** packages/rules-engine's ConditionNode tree (dsl.ts) — validated by rulesetSchema before any save. */
    definition: jsonb("definition").notNull(),
    reasonEn: text("reason_en").notNull(),
    reasonSw: text("reason_sw").notNull(),
    clinicianNote: text("clinician_note").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("rules_ruleset_idx").on(table.rulesetId)],
);

/**
 * [CLINICAL REVIEW REQUIRED] Education articles — source of truth is
 * content/{locale}/*.md (packages/assistant's ingestion script keeps `slug`/
 * `title`/`body`/`status` in sync from there); `reviewedBy`/`reviewDue` are
 * set by the staff knowledge-base review flow, not by ingestion.
 */
export const kbDocuments = clinicalSchema.table(
  "kb_documents",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    locale: text("locale").notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    status: kbStatusEnum("status").notNull().default("draft"),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewDue: date("review_due"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("kb_documents_locale_slug_idx").on(table.locale, table.slug),
  ],
);

/** pgvector HNSW index for the assistant's retrieval step. */
export const kbChunks = clinicalSchema.table(
  "kb_chunks",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    documentId: uuid("document_id")
      .notNull()
      .references(() => kbDocuments.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    embedding: vector1536("embedding").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("kb_chunks_embedding_hnsw_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  ],
);

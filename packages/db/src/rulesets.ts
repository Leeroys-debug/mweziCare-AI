import { desc, eq } from "drizzle-orm";
import type { Rule, Ruleset, RulesetStatus } from "@mwezicare/rules-engine";
import type { Database, Tx } from "./client";
import * as schema from "./schema";

function toRules(
  ruleRows: (typeof schema.rules.$inferSelect)[],
  version: number,
): Rule[] {
  return ruleRows.map((row) => ({
    id: row.code,
    version,
    priority: row.priority,
    outcome: row.outcome,
    conditions: row.definition as Rule["conditions"],
    reason: { en: row.reasonEn, sw: row.reasonSw },
    clinicianNote: row.clinicianNote,
  }));
}

/**
 * Loads the most recent ruleset with the given status and reconstructs it
 * into the @mwezicare/rules-engine Ruleset shape. Returns `null` if none
 * exists — e.g. no ruleset has been approved yet (CLAUDE.md: no clinical
 * content ships as approved without a named clinician sign-off).
 */
export async function loadRuleset(
  db: Database | Tx,
  status: RulesetStatus,
): Promise<Ruleset | null> {
  const [ruleset] = await db
    .select()
    .from(schema.rulesets)
    .where(eq(schema.rulesets.status, status))
    .orderBy(desc(schema.rulesets.version))
    .limit(1);
  if (!ruleset) return null;

  const ruleRows = await db
    .select()
    .from(schema.rules)
    .where(eq(schema.rules.rulesetId, ruleset.id))
    .orderBy(schema.rules.sortOrder);

  return {
    version: ruleset.version,
    status: ruleset.status,
    rules: toRules(ruleRows, ruleset.version),
  };
}

export interface RulesetVersionSummary {
  id: string;
  version: number;
  status: RulesetStatus;
  approvedBy: string | null;
  approvedByName: string | null;
  approvedAt: Date | null;
  createdAt: Date;
}

/** All ruleset versions, newest first — for the staff rulesets list. */
export async function listRulesetVersions(
  db: Database | Tx,
): Promise<RulesetVersionSummary[]> {
  return db
    .select()
    .from(schema.rulesets)
    .orderBy(desc(schema.rulesets.version));
}

export async function getRulesetMeta(
  db: Database | Tx,
  version: number,
): Promise<RulesetVersionSummary | null> {
  const [ruleset] = await db
    .select()
    .from(schema.rulesets)
    .where(eq(schema.rulesets.version, version));
  return ruleset ?? null;
}

/** Same as loadRuleset, but by a specific version number rather than status. */
export async function loadRulesetByVersion(
  db: Database | Tx,
  version: number,
): Promise<Ruleset | null> {
  const [ruleset] = await db
    .select()
    .from(schema.rulesets)
    .where(eq(schema.rulesets.version, version));
  if (!ruleset) return null;

  const ruleRows = await db
    .select()
    .from(schema.rules)
    .where(eq(schema.rules.rulesetId, ruleset.id))
    .orderBy(schema.rules.sortOrder);

  return {
    version: ruleset.version,
    status: ruleset.status,
    rules: toRules(ruleRows, ruleset.version),
  };
}

function toRuleRows(rulesetId: string, rules: Rule[]) {
  return rules.map((rule, i) => ({
    rulesetId,
    code: rule.id,
    priority: rule.priority,
    outcome: rule.outcome,
    definition: rule.conditions,
    reasonEn: rule.reason.en,
    reasonSw: rule.reason.sw,
    clinicianNote: rule.clinicianNote,
    sortOrder: i,
  }));
}

/** Creates a new DRAFT ruleset version (version = current max + 1) with the given rules. */
export async function createDraftRuleset(
  db: Database,
  rules: Rule[],
): Promise<RulesetVersionSummary> {
  return db.transaction(async (tx) => {
    const [latest] = await tx
      .select({ version: schema.rulesets.version })
      .from(schema.rulesets)
      .orderBy(desc(schema.rulesets.version))
      .limit(1);
    const nextVersion = (latest?.version ?? 0) + 1;

    const [created] = await tx
      .insert(schema.rulesets)
      .values({ version: nextVersion, status: "draft" })
      .returning();

    await tx.insert(schema.rules).values(toRuleRows(created!.id, rules));

    return created!;
  });
}

/**
 * Replaces a draft ruleset's rules wholesale (simplest model for a JSON-
 * editor-driven save). The clinical/0006 migration's trigger rejects this
 * at the DB layer if the ruleset has since become approved — callers
 * should still check status before calling, for a clean 409 instead of a
 * raw SQL error.
 */
export async function saveDraftRules(
  db: Database,
  rulesetId: string,
  rules: Rule[],
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(schema.rules).where(eq(schema.rules.rulesetId, rulesetId));
    await tx.insert(schema.rules).values(toRuleRows(rulesetId, rules));
  });
}

export interface ApproveRulesetInput {
  rulesetId: string;
  approvedByUserId: string;
  approvedByName: string;
}

/**
 * Retires whichever ruleset is currently approved (if any) and approves
 * this one, in one transaction — "approving retires the previous approved
 * version" (D2 rulesets spec). The clinical/0006 trigger additionally
 * enforces that an approved ruleset can only ever transition to 'retired',
 * never be edited or re-approved.
 */
export async function approveRuleset(
  db: Database,
  input: ApproveRulesetInput,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(schema.rulesets)
      .set({ status: "retired" })
      .where(eq(schema.rulesets.status, "approved"));

    await tx
      .update(schema.rulesets)
      .set({
        status: "approved",
        approvedBy: input.approvedByUserId,
        approvedByName: input.approvedByName,
        approvedAt: new Date(),
      })
      .where(eq(schema.rulesets.id, input.rulesetId));
  });
}

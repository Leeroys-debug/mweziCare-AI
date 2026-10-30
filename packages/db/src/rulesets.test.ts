import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createDb, type Database } from "./client";
import * as schema from "./schema";
import { approveRuleset } from "./rulesets";

config({ path: "../../.env" });

const databaseUrl = process.env.DATABASE_URL;
const db: Database | undefined = databaseUrl
  ? createDb(databaseUrl)
  : undefined;

describe.skipIf(!db)("approveRuleset", () => {
  it("strips [CLINICAL REVIEW REQUIRED]/[TRANSLATION REVIEW REQUIRED] tags from rule reason text on approval, without the immutability trigger blocking it", async () => {
    const [ruleset] = await db!
      .insert(schema.rulesets)
      .values({ version: 999, status: "draft" })
      .returning({ id: schema.rulesets.id });

    const [rule] = await db!
      .insert(schema.rules)
      .values({
        rulesetId: ruleset!.id,
        code: "test_rule",
        priority: 0,
        outcome: "routine",
        definition: { all: [] },
        reasonEn: "[CLINICAL REVIEW REQUIRED] Reason text.",
        reasonSw:
          "[CLINICAL REVIEW REQUIRED][TRANSLATION REVIEW REQUIRED] Maandishi.",
        clinicianNote: "[CLINICAL REVIEW REQUIRED] Internal note, untouched.",
        sortOrder: 0,
      })
      .returning({ id: schema.rules.id });

    await approveRuleset(db!, {
      rulesetId: ruleset!.id,
      approvedByUserId: "00000000-0000-4000-8000-000000000001",
      approvedByName: "Dr. Test",
    });

    const [updatedRuleset] = await db!
      .select({ status: schema.rulesets.status })
      .from(schema.rulesets)
      .where(eq(schema.rulesets.id, ruleset!.id));
    expect(updatedRuleset!.status).toBe("approved");

    const [updatedRule] = await db!
      .select()
      .from(schema.rules)
      .where(eq(schema.rules.id, rule!.id));
    expect(updatedRule!.reasonEn).toBe("Reason text.");
    expect(updatedRule!.reasonSw).toBe("Maandishi.");
    // clinicianNote is internal (never shown to users) — left as-is.
    expect(updatedRule!.clinicianNote).toBe(
      "[CLINICAL REVIEW REQUIRED] Internal note, untouched.",
    );

    // Approved rulesets can't be deleted (clinical/0006) — retire first
    // (the one mutation that trigger allows), then clean up. Deleting the
    // ruleset cascades to its rules (rulesetId has onDelete: "cascade").
    await db!
      .update(schema.rulesets)
      .set({ status: "retired" })
      .where(eq(schema.rulesets.id, ruleset!.id));
    await db!
      .delete(schema.rulesets)
      .where(eq(schema.rulesets.id, ruleset!.id));
  });
});

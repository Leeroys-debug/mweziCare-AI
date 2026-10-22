import { eq } from "drizzle-orm";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { evaluate } from "@mwezicare/rules-engine";
import {
  deriveCycles,
  extractFeatures,
  extractRedFlagFeatures,
} from "@mwezicare/triage";
import { schema, withUser } from "./index";
import { listTriageLogs } from "./symptom-logs";
import { loadRuleset } from "./rulesets";
import { startTestDatabase, type TestDatabase } from "./testcontainers-setup";

const CONTAINER_TIMEOUT_MS = 180_000;

/**
 * End-to-end: seed a symptom log with a red-flag symptom, approve a ruleset
 * whose rule matches it, run the exact same evaluate() pipeline
 * apps/web/app/api/v1/assessments/route.ts runs, and write the resulting
 * assessment row — against a database this test builds and migrates itself
 * (packages/db/src/testcontainers-setup.ts), not the dev docker-compose
 * stack or a pre-existing `.env` DATABASE_URL.
 */
describe("assessment pipeline (testcontainers)", () => {
  let testDb: TestDatabase;
  let userId: string;

  beforeAll(async () => {
    testDb = await startTestDatabase();
    const [user] = await testDb.db
      .insert(schema.users)
      .values({
        phoneNumber: `testcontainers-assessment-${Date.now()}`,
        email: `testcontainers-assessment-${Date.now()}@phone.mwezicare.invalid`,
      })
      .returning({ id: schema.users.id });
    userId = user!.id;
  }, CONTAINER_TIMEOUT_MS);

  afterAll(async () => {
    await testDb?.stop();
  }, CONTAINER_TIMEOUT_MS);

  it("evaluates a fainting red-flag log as urgent and stores the immutable assessment row", async () => {
    const [ruleset] = await testDb.db
      .insert(schema.rulesets)
      .values({ version: 1, status: "draft" })
      .returning({ id: schema.rulesets.id });
    await testDb.db.insert(schema.rules).values({
      rulesetId: ruleset!.id,
      code: "test_urgent_fainting",
      priority: 100,
      outcome: "urgent",
      definition: { feature: "fainting", operator: "eq", value: true },
      reasonEn: "Fainting can signal a medical emergency",
      reasonSw: "Kuzimia kunaweza kuashiria dharura ya matibabu",
      clinicianNote: "test fixture",
      sortOrder: 0,
    });
    await testDb.db
      .update(schema.rulesets)
      .set({ status: "approved", approvedAt: new Date() })
      .where(eq(schema.rulesets.id, ruleset!.id));

    await withUser(testDb.db, userId, (tx) =>
      tx.insert(schema.symptomLogs).values({
        userId,
        logDate: "2026-03-01",
        painScore: 2,
        redFlags: {
          suddenSeverePain: false,
          fainting: true,
          possiblePregnancySuspected: false,
        },
        clientId: "testcontainers-assessment-log",
      }),
    );

    const approvedRuleset = await loadRuleset(testDb.db, "approved");
    expect(approvedRuleset).not.toBeNull();

    const logs = await withUser(testDb.db, userId, (tx) =>
      listTriageLogs(tx, userId),
    );
    const cycles = deriveCycles(logs);
    const historyFeatures = extractFeatures(logs, cycles);
    const latestLog = logs.at(-1) ?? {};
    const redFlagFeatures = extractRedFlagFeatures(latestLog);
    const features = { ...historyFeatures, ...redFlagFeatures };
    const { outcome, reasons, firedRules } = evaluate(
      approvedRuleset!,
      features,
    );

    expect(outcome).toBe("urgent");
    expect(reasons).toEqual([
      {
        en: "Fainting can signal a medical emergency",
        sw: "Kuzimia kunaweza kuashiria dharura ya matibabu",
      },
    ]);

    const [assessment] = await withUser(testDb.db, userId, (tx) =>
      tx
        .insert(schema.assessments)
        .values({
          userId,
          rulesetVersion: approvedRuleset!.version,
          outcome,
          reasons,
          firedRuleCodes: firedRules.map((rule) => rule.id),
          features,
        })
        .returning(),
    );

    expect(assessment?.outcome).toBe("urgent");
    expect(assessment?.rulesetVersion).toBe(approvedRuleset!.version);

    const [stored] = await testDb.db
      .select()
      .from(schema.assessments)
      .where(eq(schema.assessments.id, assessment!.id));
    expect(stored?.outcome).toBe("urgent");
  });
});

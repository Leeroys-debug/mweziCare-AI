import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, schema, type Database } from "@mwezicare/db";
import { listCaseSamples } from "./case-samples";

config({ path: "../../.env" }); // dotenv resolves relative to process.cwd(), i.e. apps/web

const databaseUrl = process.env.DATABASE_URL;
const db: Database | undefined = databaseUrl
  ? createDb(databaseUrl)
  : undefined;

const RULESET_VERSION = 920000 + (Date.now() % 90000);
let unreviewedId: string;
let reviewedId: string;
let subjectUserId: string;
let clinicianId: string;

describe.skipIf(!db)("listCaseSamples", () => {
  beforeAll(async () => {
    const [subject] = await db!
      .insert(schema.users)
      .values({ email: `case-samples-subject-${Date.now()}@example.com` })
      .returning({ id: schema.users.id });
    subjectUserId = subject!.id;

    const [clinician] = await db!
      .insert(schema.users)
      .values({
        email: `case-samples-clinician-${Date.now()}@example.com`,
        role: "clinician",
      })
      .returning({ id: schema.users.id });
    clinicianId = clinician!.id;

    await db!
      .insert(schema.rulesets)
      .values({ version: RULESET_VERSION, status: "draft" });

    const [unreviewed] = await db!
      .insert(schema.assessments)
      .values({
        userId: subjectUserId,
        rulesetVersion: RULESET_VERSION,
        outcome: "urgent",
        reasons: [],
      })
      .returning({ id: schema.assessments.id });
    unreviewedId = unreviewed!.id;

    const [reviewed] = await db!
      .insert(schema.assessments)
      .values({
        userId: subjectUserId,
        rulesetVersion: RULESET_VERSION,
        outcome: "assess_soon",
        reasons: [],
      })
      .returning({ id: schema.assessments.id });
    reviewedId = reviewed!.id;

    // Two reviews for the same assessment — listCaseSamples should surface
    // only the most recent one.
    await db!.insert(schema.assessmentReviews).values({
      assessmentId: reviewedId,
      reviewedBy: clinicianId,
      verdict: "uncertain",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    await db!.insert(schema.assessmentReviews).values({
      assessmentId: reviewedId,
      reviewedBy: clinicianId,
      verdict: "appropriate",
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
    });
  });

  afterAll(async () => {
    await db!
      .delete(schema.assessmentReviews)
      .where(eq(schema.assessmentReviews.assessmentId, reviewedId));
    await db!
      .delete(schema.assessments)
      .where(eq(schema.assessments.id, unreviewedId));
    await db!
      .delete(schema.assessments)
      .where(eq(schema.assessments.id, reviewedId));
    await db!
      .delete(schema.rulesets)
      .where(eq(schema.rulesets.version, RULESET_VERSION));
    await db!.delete(schema.users).where(eq(schema.users.id, subjectUserId));
    await db!.delete(schema.users).where(eq(schema.users.id, clinicianId));
  });

  it("returns null review for an assessment that hasn't been reviewed", async () => {
    const samples = await listCaseSamples(db!);
    const sample = samples.find((s) => s.id === unreviewedId);
    expect(sample).toBeDefined();
    expect(sample!.review).toBeNull();
  });

  it("returns only the most recent verdict for an assessment reviewed more than once", async () => {
    const samples = await listCaseSamples(db!);
    const sample = samples.find((s) => s.id === reviewedId);
    expect(sample).toBeDefined();
    expect(sample!.review?.verdict).toBe("appropriate");
  });
});

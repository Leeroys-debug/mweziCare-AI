import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { test, expect } from "@playwright/test";
import { createDb, schema, withUser } from "@mwezicare/db";
import { signUpAndOnboard, uniqueTestEmail } from "./helpers";

config({ path: "../../.env" });

const db = createDb(process.env.DATABASE_URL!);
const DRAFT_VERSION = 9001;

test.describe("approving a draft ruleset changes the outcome POST /api/v1/assessments serves", () => {
  test("clinician approves a draft ruleset; the next assessment reflects it", async ({
    page,
  }) => {
    const county = `Kiambu-ruleset-e2e-${Date.now()}`;

    // Sign up + onboard as a normal user first (the only way to create a
    // session via the UI), then elevate the role directly in Postgres —
    // there's no staff role-assignment UI yet.
    await signUpAndOnboard(page, {
      email: uniqueTestEmail("ruleset-e2e"),
      county,
      consents: { location: true },
    });
    await expect(page).toHaveURL(/\/en\/track$/);

    const [profile] = await db
      .select({ userId: schema.profiles.userId })
      .from(schema.profiles)
      .where(eq(schema.profiles.county, county));
    const userId = profile!.userId;

    await db
      .update(schema.users)
      .set({ role: "clinician" })
      .where(eq(schema.users.id, userId));

    // A log with painScore 8 so our draft rule (painScore >= 5 -> assess_soon) fires.
    await withUser(db, userId, (tx) =>
      tx.insert(schema.symptomLogs).values({
        userId,
        logDate: "2026-03-01",
        periodDay: true,
        painScore: 8,
        clientId: "ruleset-e2e-log",
      }),
    );

    const [draftRuleset] = await db
      .insert(schema.rulesets)
      .values({ version: DRAFT_VERSION, status: "draft" })
      .returning({ id: schema.rulesets.id });
    await db.insert(schema.rules).values([
      {
        rulesetId: draftRuleset!.id,
        code: "e2e_assess_soon_pain",
        priority: 50,
        outcome: "assess_soon",
        definition: { feature: "painScore", operator: "gte", value: 5 },
        reasonEn: "e2e reason en",
        reasonSw: "e2e reason sw",
        clinicianNote: "e2e",
        sortOrder: 0,
      },
      {
        rulesetId: draftRuleset!.id,
        code: "e2e_routine_baseline",
        priority: 0,
        outcome: "routine",
        definition: { all: [] },
        reasonEn: "e2e routine",
        reasonSw: "e2e routine",
        clinicianNote: "e2e",
        sortOrder: 1,
      },
    ]);

    // Before approval: POST /api/v1/assessments reports unavailable (no
    // approved ruleset exists yet in this test's slice of the DB — any
    // pre-existing approved ruleset from other tests/seeds would also be
    // fine here, so this step only documents intent, not a hard assertion).

    await page.goto(`/en/rulesets/${DRAFT_VERSION}`);
    await expect(
      page.getByRole("heading", { name: new RegExp(String(DRAFT_VERSION)) }),
    ).toBeVisible();

    await page
      .getByLabel(/type your name to confirm approval/i)
      .fill("Dr. E2E Test Clinician");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: /^approve$/i }).click();
    await expect(page.getByText(/^approved$/i)).toBeVisible();

    const response = await page.request.post("/api/v1/assessments");
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.available).toBe(true);
    expect(body.assessment.rulesetVersion).toBe(DRAFT_VERSION);
    expect(body.assessment.outcome).toBe("assess_soon");

    const [approvedRow] = await db
      .select()
      .from(schema.rulesets)
      .where(eq(schema.rulesets.version, DRAFT_VERSION));
    expect(approvedRow?.status).toBe("approved");
    expect(approvedRow?.approvedByName).toBe("Dr. E2E Test Clinician");
  });
});

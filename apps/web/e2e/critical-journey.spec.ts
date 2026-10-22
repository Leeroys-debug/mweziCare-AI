import { readFile } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import { eq, like } from "drizzle-orm";
import { test, expect } from "@playwright/test";
import { createDb, schema } from "@mwezicare/db";
import { OTP_CAPTURE_DIR } from "../playwright.config";

config({ path: "../../.env" });

const db = createDb(process.env.DATABASE_URL!);
const RULESET_VERSION = 9900;
const FACILITY_CODE_PREFIX = "E2E-CRITICAL-";

async function readCapturedOtp(e164Phone: string): Promise<string> {
  const file = path.join(
    OTP_CAPTURE_DIR,
    `${encodeURIComponent(e164Phone)}.txt`,
  );
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      return (await readFile(file, "utf8")).trim();
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`Timed out waiting for OTP capture file: ${file}`);
}

/**
 * One continuous pass through the whole product, end to end: sign up,
 * onboard, log a symptom offline and sync it, see the resulting triage
 * assessment, find a nearby verified facility and record contacting it,
 * create and then revoke a clinician-summary share link, ask the assistant
 * a question, and finally delete the account. Staff journeys (ruleset
 * approval, facility verification) have their own dedicated specs — this
 * one approves a ruleset directly via Postgres (not through the clinician
 * UI) purely so the assessment step has something meaningful to show.
 */
test.describe("critical user journey", () => {
  test.beforeAll(async () => {
    await db
      .insert(schema.rulesets)
      .values({ version: RULESET_VERSION, status: "draft" })
      .onConflictDoNothing();
    const [ruleset] = await db
      .select({ id: schema.rulesets.id, status: schema.rulesets.status })
      .from(schema.rulesets)
      .where(eq(schema.rulesets.version, RULESET_VERSION));
    if (ruleset?.status === "draft") {
      await db.insert(schema.rules).values({
        rulesetId: ruleset.id,
        code: "e2e_critical_journey_routine_baseline",
        priority: 0,
        outcome: "routine",
        definition: { all: [] },
        reasonEn: "Keep tracking as usual",
        reasonSw: "Endelea kufuatilia kama kawaida",
        clinicianNote: "e2e critical-journey fixture",
        sortOrder: 0,
      });
      await db
        .update(schema.rulesets)
        .set({
          status: "approved",
          approvedAt: new Date(),
          approvedByName: "e2e fixture",
        })
        .where(eq(schema.rulesets.id, ruleset.id));
    }

    const [facility] = await db
      .insert(schema.facilities)
      .values({
        kmhflCode: `${FACILITY_CODE_PREFIX}VERIFIED`,
        name: "Critical Journey Health Centre",
        county: "Kiambu",
        geom: { lat: -1.172, lng: 36.836 },
        phone: "+254700030099",
      })
      .onConflictDoUpdate({
        target: schema.facilities.kmhflCode,
        set: { name: "Critical Journey Health Centre" },
      })
      .returning({ id: schema.facilities.id });
    await db
      .insert(schema.facilityServices)
      .values({
        facilityId: facility!.id,
        serviceCode: "GYN",
        status: "verified",
        lastVerifiedAt: new Date(),
        source: "e2e-fixture",
      })
      .onConflictDoUpdate({
        target: [
          schema.facilityServices.facilityId,
          schema.facilityServices.serviceCode,
        ],
        set: { status: "verified", lastVerifiedAt: new Date() },
      });
  });

  test.afterAll(async () => {
    await db
      .update(schema.rulesets)
      .set({ status: "retired" })
      .where(eq(schema.rulesets.version, RULESET_VERSION));
    await db
      .delete(schema.assessments)
      .where(eq(schema.assessments.rulesetVersion, RULESET_VERSION));
    await db
      .delete(schema.rulesets)
      .where(eq(schema.rulesets.version, RULESET_VERSION));

    const facilities = await db
      .select({ id: schema.facilities.id })
      .from(schema.facilities)
      .where(like(schema.facilities.kmhflCode, `${FACILITY_CODE_PREFIX}%`));
    for (const facility of facilities) {
      await db
        .delete(schema.referrals)
        .where(eq(schema.referrals.facilityId, facility.id));
    }
    await db
      .delete(schema.facilities)
      .where(like(schema.facilities.kmhflCode, `${FACILITY_CODE_PREFIX}%`));
  });

  test("sign up, onboard, log offline, sync, see an assessment, find care, share a summary, ask the assistant, delete account", async ({
    page,
    context,
  }) => {
    test.setTimeout(240_000);

    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: -1.1714, longitude: 36.8356 });

    const localPhone = `07${Date.now().toString().slice(-8)}`;
    const e164Phone = `+254${localPhone.slice(1)}`;
    const county = `Kiambu-critical-e2e-${Date.now()}`;

    // --- Sign up + onboarding ---------------------------------------
    await page.goto("/en/sign-in");
    await page.getByLabel(/phone number/i).fill(localPhone);
    await page.getByRole("button", { name: /send code/i }).click();
    const code = await readCapturedOtp(e164Phone);
    await page.getByLabel(/verification code/i).fill(code);
    await page.getByRole("button", { name: /^verify$/i }).click();

    await expect(page).toHaveURL(/\/en\/onboarding$/, { timeout: 20000 });
    await page.getByLabel(/age band/i).selectOption("21-24");
    await page.getByLabel(/county/i).fill(county);
    await page.getByLabel(/location/i).check();
    await page.getByLabel(/share a summary with a clinician/i).check();
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page).toHaveURL(/\/en\/track$/, { timeout: 20000 });

    const [profile] = await db
      .select({ userId: schema.profiles.userId })
      .from(schema.profiles)
      .where(eq(schema.profiles.county, county));
    const userId = profile!.userId;

    // --- Log offline, then sync --------------------------------------
    await context.setOffline(true);
    await page.getByRole("button", { name: /on my period today/i }).click();
    await page.getByRole("button", { name: /^save$/i }).click();
    await expect(page.getByText(/offline.*will sync later/i)).toBeVisible();

    await context.setOffline(false);
    await expect(page.getByText(/^synced$/i)).toBeVisible({ timeout: 15000 });

    // --- Assessment ---------------------------------------------------
    // Syncing fires POST /api/v1/assessments itself (lib/sync-engine.ts) —
    // poll rather than assert immediately, since that request is
    // fire-and-forget from the client's point of view.
    await expect
      .poll(
        async () => {
          const [assessment] = await db
            .select({ id: schema.assessments.id })
            .from(schema.assessments)
            .where(eq(schema.assessments.userId, userId));
          return Boolean(assessment);
        },
        { timeout: 15000 },
      )
      .toBe(true);

    await page.goto("/en/insights");
    await expect(
      page.getByText(/general guidance based on your tracked patterns/i),
    ).toBeVisible({
      timeout: 10000,
    });

    // --- Find care ------------------------------------------------------
    await page.goto("/en/care");
    await page.getByRole("button", { name: /share my location/i }).click();

    const card = page
      .getByTestId("facility-card")
      .filter({ hasText: "Critical Journey Health Centre" });
    await expect(card).toBeVisible({ timeout: 10000 });
    await card
      .getByRole("button", { name: /i contacted this facility/i })
      .click();
    await expect(card.getByRole("button", { name: /recorded/i })).toBeVisible();

    // --- Create and revoke a clinician summary ------------------------
    await page.goto("/en/summary");
    await page.getByRole("button", { name: /generate summary/i }).click();
    await expect(page.getByText(/share link/i)).toBeVisible({ timeout: 30000 });

    const shareUrl = (await page.locator("body").innerText()).match(
      /http:\/\/[^\s]+\/s\/[A-Za-z0-9_-]+/,
    )?.[0];
    expect(shareUrl).toBeTruthy();

    const publicContext = await context.browser()!.newContext();
    const publicPage = await publicContext.newPage();
    await publicPage.goto(shareUrl!);
    await expect(
      publicPage.getByText(/clinician summary/i).first(),
    ).toBeVisible();
    await publicContext.close();

    const revokeResponse = page.waitForResponse((res) =>
      res.url().includes("/revoke"),
    );
    await page.getByRole("button", { name: /revoke link/i }).click();
    await revokeResponse;

    const revokedContext = await context.browser()!.newContext();
    const revokedPage = await revokedContext.newPage();
    const revokedResponse = await revokedPage.goto(shareUrl!);
    expect(revokedResponse?.status()).toBe(404);
    await revokedContext.close();

    // --- Ask the assistant a question ----------------------------------
    // No assertion on the answer's content — AI_GATEWAY_API_KEY is a
    // placeholder in this environment, so the pipeline may fall through to
    // the generic error message rather than a real generated answer. What
    // this proves is that the full request/SSE/UI round trip completes.
    await page.goto("/en/assistant");
    await page
      .getByLabel(/your question/i)
      .fill("What foods help with period cramps?");
    await page.getByRole("button", { name: /^send$/i }).click();
    await expect(
      page.getByText("What foods help with period cramps?"),
    ).toBeVisible();
    // Button text reverts from "Thinking…" back to "Send" once the
    // request/SSE round trip completes (it stays disabled afterward since
    // the input is now empty — that's expected, not asserted here).
    await expect(page.getByRole("button", { name: /^send$/i })).toBeVisible({
      timeout: 30000,
    });

    // --- Delete account -------------------------------------------------
    page.once("dialog", (dialog) => dialog.accept());
    await page.goto("/en/me");
    await page.getByRole("button", { name: /delete account/i }).click();
    await expect(page).toHaveURL(/\/en\/?$/);

    await expect
      .poll(
        async () => {
          const [user] = await db
            .select({ deletionRequestedAt: schema.users.deletionRequestedAt })
            .from(schema.users)
            .where(eq(schema.users.id, userId));
          return user?.deletionRequestedAt != null;
        },
        { timeout: 5000 },
      )
      .toBe(true);

    await page.goto("/en/track");
    await expect(page).toHaveURL(/\/en\/sign-in$/);
  });
});

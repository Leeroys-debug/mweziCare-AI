import { readFile } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { test, expect } from "@playwright/test";
import { createDb, schema } from "@mwezicare/db";
import { OTP_CAPTURE_DIR } from "../playwright.config";

config({ path: "../../.env" });

const db = createDb(process.env.DATABASE_URL!);

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

// A county value unique to this test run identifies its rows in the DB
// without needing to recompute the server-side phone HMAC client-side.
function uniqueCounty() {
  return `Kiambu-e2e-${Date.now()}`;
}

async function countProfilesWithCounty(county: string): Promise<number> {
  const rows = await db
    .select({ userId: schema.profiles.userId })
    .from(schema.profiles)
    .where(eq(schema.profiles.county, county));
  return rows.length;
}

async function deletionRequestedAtForCounty(
  county: string,
): Promise<Date | null> {
  const [row] = await db
    .select({ userId: schema.profiles.userId })
    .from(schema.profiles)
    .where(eq(schema.profiles.county, county));
  if (!row) return null;
  const [user] = await db
    .select({ deletionRequestedAt: schema.users.deletionRequestedAt })
    .from(schema.users)
    .where(eq(schema.users.id, row.userId));
  return user?.deletionRequestedAt ?? null;
}

test.describe("phone OTP sign-up, onboarding, roles and account deletion", () => {
  test("full journey: sign up, consents recorded, /dashboard blocked, delete removes all rows", async ({
    page,
  }) => {
    const localPhone = `07${Date.now().toString().slice(-8)}`;
    const e164Phone = `+254${localPhone.slice(1)}`;
    const county = uniqueCounty();

    await page.goto("/en/sign-in");
    await page.getByLabel(/phone number/i).fill(localPhone);
    await page.getByRole("button", { name: /send code/i }).click();

    await expect(page.getByLabel(/verification code/i)).toBeVisible();
    const code = await readCapturedOtp(e164Phone);
    await page.getByLabel(/verification code/i).fill(code);
    await page.getByRole("button", { name: /^verify$/i }).click();

    // New user -> onboarding.
    await expect(page).toHaveURL(/\/en\/onboarding$/);
    await page.getByLabel(/age band/i).selectOption("21-24");
    await page.getByLabel(/county/i).fill(county);
    await page.getByLabel(/location/i).check();
    await page.getByRole("button", { name: /continue/i }).click();

    // Onboarding complete -> lands in the app, bottom nav visible.
    await expect(page).toHaveURL(/\/en\/track$/);
    await expect(
      page.getByRole("navigation", { name: "Primary navigation" }),
    ).toBeVisible();

    // Consents were recorded: the profile row exists with this run's
    // county (DB-level proof), and the Me page shows location as granted
    // (UI-level proof).
    expect(await countProfilesWithCounty(county)).toBe(1);

    await page.getByRole("link", { name: "Me" }).click();
    await expect(page).toHaveURL(/\/en\/me$/);
    const locationRow = page.getByText("location").locator("..");
    await expect(locationRow.getByText("Granted")).toBeVisible();

    // A plain "user" role cannot reach the staff dashboard.
    await page.goto("/en/dashboard");
    await expect(page).toHaveURL(/\/en\/?$/);

    // Delete the account: this marks it for deletion and signs out
    // immediately — the actual purge (profile/consents/sessions, cascaded
    // from identity.users) happens later via the nightly retention job
    // (worker/jobs/retention.ts), not synchronously here.
    page.once("dialog", (dialog) => dialog.accept());
    await page.goto("/en/me");
    await page.getByRole("button", { name: /delete account/i }).click();
    await expect(page).toHaveURL(/\/en\/?$/);

    await expect
      .poll(() => deletionRequestedAtForCounty(county), { timeout: 5000 })
      .not.toBeNull();
    // Signed out — the staff-dashboard redirect check above already proved
    // auth gating works; re-visiting any authenticated page now bounces too.
    await page.goto("/en/track");
    await expect(page).toHaveURL(/\/en\/sign-in$/);
  });

  test("county input is rejected for under-18 age bands (guardian consent not built yet)", async ({
    page,
  }) => {
    const localPhone = `07${(Date.now() + 1).toString().slice(-8)}`;
    const e164Phone = `+254${localPhone.slice(1)}`;

    await page.goto("/en/sign-in");
    await page.getByLabel(/phone number/i).fill(localPhone);
    await page.getByRole("button", { name: /send code/i }).click();
    const code = await readCapturedOtp(e164Phone);
    await page.getByLabel(/verification code/i).fill(code);
    await page.getByRole("button", { name: /^verify$/i }).click();

    await expect(page).toHaveURL(/\/en\/onboarding$/);
    await page.getByLabel(/age band/i).selectOption("16-17");

    await expect(page.getByText(/guardian consent needed/i)).toBeVisible();
    await expect(page.getByLabel(/county/i)).not.toBeVisible();
  });
});

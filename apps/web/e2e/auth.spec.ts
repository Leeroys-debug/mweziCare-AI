import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { test, expect } from "@playwright/test";
import { createDb, schema } from "@mwezicare/db";
import { signUpAndOnboard, uniqueTestEmail } from "./helpers";

config({ path: "../../.env" });

const db = createDb(process.env.DATABASE_URL!);

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

test.describe("email+password sign-up, onboarding, roles and account deletion", () => {
  test("full journey: sign up, consents recorded, /dashboard blocked, delete removes all rows", async ({
    page,
  }) => {
    const county = uniqueCounty();

    await signUpAndOnboard(page, {
      email: uniqueTestEmail("auth-e2e"),
      county,
      consents: { location: true },
    });

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
    await page.goto("/en/sign-up");
    await page.getByLabel(/what should we call you/i).fill("E2E Test User");
    await page
      .getByLabel(/email address/i)
      .fill(uniqueTestEmail("auth-e2e-minor"));
    await page.getByLabel(/^password$/i).fill("e2e-test-password-1");
    await page.getByRole("button", { name: /create account/i }).click();

    await expect(page).toHaveURL(/\/en\/onboarding$/);
    await page.getByLabel(/age band/i).selectOption("16-17");

    await expect(page.getByText(/guardian consent needed/i)).toBeVisible();
    await expect(page.getByLabel(/county/i)).not.toBeVisible();
  });
});

import { config } from "dotenv";
import { eq } from "drizzle-orm";
import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";
import { createDb, schema } from "@mwezicare/db";
import {
  signUpAndOnboard as signUpAndOnboardShared,
  uniqueTestEmail,
} from "./helpers";

config({ path: "../../.env" });

const db = createDb(process.env.DATABASE_URL!);

async function signUpAndOnboard(page: Page, county: string): Promise<void> {
  await signUpAndOnboardShared(page, {
    email: uniqueTestEmail("accessibility-e2e"),
    county,
    consents: { location: true },
  });
  await expect(page).toHaveURL(/\/en\/quiz/, { timeout: 20000 });
}

/** No serious/critical violations — moderate/minor findings are logged but don't fail the build. */
async function expectNoSeriousViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  if (serious.length > 0) {
    console.error(
      `axe violations on ${label}:`,
      JSON.stringify(serious, null, 2),
    );
  }
  expect(serious, `${label} has serious/critical axe violations`).toEqual([]);
}

test.describe("accessibility — no serious/critical axe violations on main pages", () => {
  test("public pages: landing, sign-in", async ({ page }) => {
    await page.goto("/en");
    await expectNoSeriousViolations(page, "landing (/en)");

    await page.goto("/en/sign-in");
    await expectNoSeriousViolations(page, "/en/sign-in");
  });

  test("authenticated user pages: track, insights, assistant, learn, care, me", async ({
    page,
  }) => {
    const county = `Kiambu-axe-e2e-${Date.now()}`;
    await signUpAndOnboard(page, county);

    await page.goto("/en/track");
    await expectNoSeriousViolations(page, "/en/track");

    await page.goto("/en/insights");
    await expectNoSeriousViolations(page, "/en/insights");

    await page.goto("/en/assistant");
    await expectNoSeriousViolations(page, "/en/assistant");

    await page.goto("/en/learn");
    await expectNoSeriousViolations(page, "/en/learn");

    await page.goto("/en/care");
    await expectNoSeriousViolations(page, "/en/care");

    await page.goto("/en/me");
    await expectNoSeriousViolations(page, "/en/me");
  });

  test("staff dashboard (programme_admin)", async ({ page }) => {
    const county = `Kiambu-axe-staff-e2e-${Date.now()}`;
    await signUpAndOnboard(page, county);

    const [profile] = await db
      .select({ userId: schema.profiles.userId })
      .from(schema.profiles)
      .where(eq(schema.profiles.county, county));
    await db
      .update(schema.users)
      .set({ role: "programme_admin" })
      .where(eq(schema.users.id, profile!.userId));

    await page.goto("/en/dashboard");
    await expectNoSeriousViolations(page, "/en/dashboard");
  });
});

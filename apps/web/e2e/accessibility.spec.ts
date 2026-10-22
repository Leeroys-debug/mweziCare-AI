import { readFile } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";
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

/** Signs up a fresh user via the real OTP flow and completes onboarding — the only way to get a session. */
async function signUpAndOnboard(page: Page, county: string): Promise<void> {
  const localPhone = `07${Date.now().toString().slice(-8)}`;
  const e164Phone = `+254${localPhone.slice(1)}`;

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
  await page.getByRole("button", { name: /continue/i }).click();
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
  test("public pages: landing, sign-in, learn", async ({ page }) => {
    await page.goto("/en");
    await expectNoSeriousViolations(page, "landing (/en)");

    await page.goto("/en/sign-in");
    await expectNoSeriousViolations(page, "/en/sign-in");

    await page.goto("/en/learn");
    await expectNoSeriousViolations(page, "/en/learn");
  });

  test("authenticated user pages: track, insights, assistant, care, me", async ({
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

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

function uniqueCounty() {
  return `Kiambu-offline-e2e-${Date.now()}`;
}

async function findUserIdByCounty(county: string): Promise<string> {
  const [profile] = await db
    .select({ userId: schema.profiles.userId })
    .from(schema.profiles)
    .where(eq(schema.profiles.county, county));
  if (!profile) throw new Error(`No profile found for county ${county}`);
  return profile.userId;
}

async function countLogsForDate(
  userId: string,
  logDate: string,
): Promise<number> {
  const rows = await db
    .select({ id: schema.symptomLogs.id, logDate: schema.symptomLogs.logDate })
    .from(schema.symptomLogs)
    .where(eq(schema.symptomLogs.userId, userId));
  return rows.filter((r) => r.logDate === logDate).length;
}

test.describe("offline symptom log, synced once back online", () => {
  test("a log saved offline is queued, then synced exactly once (no duplicates) when back online", async ({
    page,
    context,
  }) => {
    const localPhone = `07${Date.now().toString().slice(-8)}`;
    const e164Phone = `+254${localPhone.slice(1)}`;
    const county = uniqueCounty();
    const today = new Date().toISOString().slice(0, 10);

    await page.goto("/en/sign-in");
    await page.getByLabel(/phone number/i).fill(localPhone);
    await page.getByRole("button", { name: /send code/i }).click();
    const code = await readCapturedOtp(e164Phone);
    await page.getByLabel(/verification code/i).fill(code);
    await page.getByRole("button", { name: /^verify$/i }).click();

    // Generous timeout: a freshly-booted dev server JIT-compiles /onboarding
    // on first visit, which can take longer than Playwright's 5s default.
    await expect(page).toHaveURL(/\/en\/onboarding$/, { timeout: 20000 });
    await page.getByLabel(/age band/i).selectOption("21-24");
    await page.getByLabel(/county/i).fill(county);
    await page.getByLabel(/location/i).check();
    await page.getByRole("button", { name: /continue/i }).click();

    await expect(page).toHaveURL(/\/en\/track$/, { timeout: 20000 });

    // Go offline before logging — the save must still work (IndexedDB only).
    await context.setOffline(true);

    await page.getByRole("button", { name: /on my period today/i }).click();
    await page.getByRole("button", { name: /^heavy$/i }).click();
    const slider = page.getByRole("slider", { name: /pain/i });
    await slider.focus();
    for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
    await page.getByRole("button", { name: /^fatigue$/i }).click();
    await page.getByRole("button", { name: /^save$/i }).click();

    await expect(page.getByText(/offline.*will sync later/i)).toBeVisible();

    // Nothing should have reached the server yet.
    const userId = await findUserIdByCounty(county);
    expect(await countLogsForDate(userId, today)).toBe(0);

    await context.setOffline(false);

    await expect(page.getByText(/^synced$/i)).toBeVisible({ timeout: 15000 });

    await expect
      .poll(() => countLogsForDate(userId, today), { timeout: 10000 })
      .toBe(1);

    // Reloading and re-saving (simulating a retry/duplicate sync attempt)
    // must not create a second row for the same date.
    await page.reload();
    await expect(page.getByRole("button", { name: /^save$/i })).toBeVisible();
    await page.getByRole("button", { name: /^save$/i }).click();
    await expect(page.getByText(/^synced$/i)).toBeVisible({ timeout: 15000 });
    expect(await countLogsForDate(userId, today)).toBe(1);
  });
});

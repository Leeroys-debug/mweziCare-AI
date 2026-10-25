import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { test, expect } from "@playwright/test";
import { createDb, schema } from "@mwezicare/db";
import { signUpAndOnboard, uniqueTestEmail } from "./helpers";

config({ path: "../../.env" });

const db = createDb(process.env.DATABASE_URL!);

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
    const county = uniqueCounty();
    const today = new Date().toISOString().slice(0, 10);

    // Generous timeout: a freshly-booted dev server JIT-compiles /onboarding
    // on first visit, which can take longer than Playwright's 5s default.
    await signUpAndOnboard(page, {
      email: uniqueTestEmail("track-offline-e2e"),
      county,
      consents: { location: true },
    });

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

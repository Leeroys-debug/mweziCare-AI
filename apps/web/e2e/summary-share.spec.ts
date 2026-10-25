import { config } from "dotenv";
import { test, expect } from "@playwright/test";
import { signUpAndOnboard, uniqueTestEmail } from "./helpers";

config({ path: "../../.env" });

test.describe("Clinician summary: create, open, revoke", () => {
  test("creating a summary requires sharing consent; once granted, the share link works until revoked (then 404s)", async ({
    page,
    context,
  }) => {
    // Generous: sign-up + onboarding + a log + two PDF-generation round
    // trips (consent-denied attempt, then the real one) easily exceeds the
    // 30s default, especially against a cold Turbopack compile.
    test.setTimeout(120_000);

    const county = `Kiambu-summary-e2e-${Date.now()}`;

    await signUpAndOnboard(page, {
      email: uniqueTestEmail("summary-share-e2e"),
      county,
      consents: { location: true },
    });
    await expect(page).toHaveURL(/\/en\/track$/, { timeout: 20000 });

    // Log a day so the summary has at least one cycle to show.
    await page.getByRole("button", { name: /on my period today/i }).click();
    await page.getByRole("button", { name: /^save$/i }).click();
    await expect(page.getByText(/^synced$/i)).toBeVisible({ timeout: 15000 });

    // Creating a summary without sharing consent is rejected with a clear message.
    await page.goto("/en/summary");
    await page.getByRole("button", { name: /generate summary/i }).click();
    await expect(page.getByText(/sharing.*consent/i)).toBeVisible({
      timeout: 10000,
    });

    // Grant sharing consent from the Me page. The click only dispatches the
    // DOM event — it doesn't wait for the component's internal fetch, so
    // wait for that response directly before navigating away.
    await page.goto("/en/me");
    const sharingRow = page.locator(
      '[data-testid="consent-row"][data-purpose="sharing"]',
    );
    const grantResponse = page.waitForResponse((res) =>
      res.url().includes("/consents/sharing"),
    );
    await sharingRow.getByRole("button", { name: /grant/i }).click();
    await grantResponse;

    // Now generation succeeds and shows a share link.
    await page.goto("/en/summary");
    await page.getByRole("button", { name: /generate summary/i }).click();
    await expect(page.getByText(/share link/i)).toBeVisible({ timeout: 30000 });

    const shareUrl = (await page.locator("body").innerText()).match(
      /http:\/\/[^\s]+\/s\/[A-Za-z0-9_-]+/,
    )?.[0];
    expect(shareUrl).toBeTruthy();

    // The public link opens, read-only, from a completely separate (unauthenticated) context.
    const publicContext = await context.browser()!.newContext();
    const publicPage = await publicContext.newPage();
    await publicPage.goto(shareUrl!);
    await expect(
      publicPage.getByText(/clinician summary/i).first(),
    ).toBeVisible();
    await expect(
      publicPage.getByRole("link", { name: /download pdf/i }),
    ).toBeVisible();
    await publicContext.close();

    // Revoking kills public access.
    const revokeResponse = page.waitForResponse((res) =>
      res.url().includes("/revoke"),
    );
    await page.getByRole("button", { name: /revoke link/i }).click();
    await revokeResponse;

    const revokedContext = await context.browser()!.newContext();
    const revokedPage = await revokedContext.newPage();
    const response = await revokedPage.goto(shareUrl!);
    expect(response?.status()).toBe(404);
    await revokedContext.close();
  });
});

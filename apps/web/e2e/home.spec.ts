import { test, expect } from "@playwright/test";

test("home page loads and redirects to the default locale", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/en\/?$/);
  await expect(
    page.getByRole("heading", { name: "MweziCare AI" }),
  ).toBeVisible();
});

test("the Swahili home page loads", async ({ page }) => {
  await page.goto("/sw");
  await expect(
    page.getByRole("heading", { name: "MweziCare AI" }),
  ).toBeVisible();
});

test("visiting the app while signed out redirects to sign-in", async ({
  page,
}) => {
  // (user) routes require auth (lib/rbac.ts requireUser) — see
  // e2e/auth.spec.ts for the signed-in bottom-nav assertion.
  await page.goto("/en/track");
  await expect(page).toHaveURL(/\/en\/sign-in$/);
});

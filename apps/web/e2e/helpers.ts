import { expect, type Page } from "@playwright/test";

export function uniqueTestEmail(prefix: string): string {
  return `${prefix}-${Date.now()}@example.com`;
}

const DEFAULT_PASSWORD = "e2e-test-password-1";

export interface SignUpAndOnboardOptions {
  email: string;
  password?: string;
  name?: string;
  ageBand?: string;
  county: string;
  consents?: {
    location?: boolean;
    research?: boolean;
    sharing?: boolean;
  };
}

/** Signs up a fresh user via the real email+password flow and completes onboarding — the only way to get a session. */
export async function signUpAndOnboard(
  page: Page,
  options: SignUpAndOnboardOptions,
): Promise<void> {
  const password = options.password ?? DEFAULT_PASSWORD;

  await page.goto("/en/sign-up");
  await page
    .getByLabel(/what should we call you/i)
    .fill(options.name ?? "E2E Test User");
  await page.getByLabel(/email address/i).fill(options.email);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByRole("button", { name: /create account/i }).click();

  await expect(page).toHaveURL(/\/en\/onboarding$/, { timeout: 20000 });
  await page.getByLabel(/age band/i).selectOption(options.ageBand ?? "21-24");
  await page.getByLabel(/county/i).fill(options.county);
  if (options.consents?.location) await page.getByLabel(/location/i).check();
  if (options.consents?.research) await page.getByLabel(/research/i).check();
  if (options.consents?.sharing) {
    await page.getByLabel(/share a summary with a clinician/i).check();
  }
  await page.getByRole("button", { name: /continue/i }).click();
}

export async function signIn(
  page: Page,
  email: string,
  password: string = DEFAULT_PASSWORD,
): Promise<void> {
  await page.goto("/en/sign-in");
  await page.getByLabel(/email address/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
}

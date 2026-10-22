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

test.describe("a verifier marking a facility's GYN service verified surfaces in (user)/care", () => {
  test("verify via the staff console, then find it as confirmed in Care", async ({
    page,
  }) => {
    const localPhone = `07${(Date.now() + 3).toString().slice(-8)}`;
    const e164Phone = `+254${localPhone.slice(1)}`;
    const county = `Kiambu-facility-e2e-${Date.now()}`;
    const facilityName = `E2E Test Health Centre ${Date.now()}`;

    const [facility] = await db
      .insert(schema.facilities)
      .values({
        kmhflCode: `E2E-${Date.now()}`,
        name: facilityName,
        county: "Kiambu",
        geom: { lat: -1.1715, lng: 36.8356 },
      })
      .returning({ id: schema.facilities.id });
    await db.insert(schema.facilityServices).values({
      facilityId: facility!.id,
      serviceCode: "GYN",
      status: "listed",
    });

    await page.goto("/en/sign-in");
    await page.getByLabel(/phone number/i).fill(localPhone);
    await page.getByRole("button", { name: /send code/i }).click();
    const code = await readCapturedOtp(e164Phone);
    await page.getByLabel(/verification code/i).fill(code);
    await page.getByRole("button", { name: /^verify$/i }).click();

    await expect(page).toHaveURL(/\/en\/onboarding$/);
    await page.getByLabel(/age band/i).selectOption("21-24");
    await page.getByLabel(/county/i).fill(county);
    await page.getByLabel(/location/i).check();
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page).toHaveURL(/\/en\/track$/);

    const [profile] = await db
      .select({ userId: schema.profiles.userId })
      .from(schema.profiles)
      .where(eq(schema.profiles.county, county));
    await db
      .update(schema.users)
      .set({ role: "verifier" })
      .where(eq(schema.users.id, profile!.userId));

    await page.goto(`/en/facilities/${facility!.id}`);
    await expect(
      page.getByRole("heading", { name: facilityName }),
    ).toBeVisible();

    await page.getByLabel(/phone number confirmed/i).check();
    await page.getByLabel(/gynaecology service available/i).check();
    await page.getByLabel(/days\/hours/i).fill("Mon-Fri 8am-5pm");
    await page.getByLabel(/notes/i).fill("Confirmed by phone — e2e test.");
    await page.getByRole("button", { name: /mark verified/i }).click();
    await expect(page.getByText(/^recorded$/i)).toBeVisible();

    const [service] = await db
      .select()
      .from(schema.facilityServices)
      .where(eq(schema.facilityServices.facilityId, facility!.id));
    expect(service?.status).toBe("verified");

    // Confirm it shows as verified in the user-facing Care tab's area search.
    await page.goto("/en/care");
    await page.getByLabel(/county/i).fill("Kiambu");
    await page.getByLabel(/facility name or town/i).fill(facilityName);
    await page.getByRole("button", { name: /^search$/i }).click();

    const card = page.locator(
      `[data-testid="facility-card"][data-facility-id="${facility!.id}"]`,
    );
    await expect(card).toBeVisible();
    await expect(card.getByText(/gynaecology confirmed on/i)).toBeVisible();
  });
});

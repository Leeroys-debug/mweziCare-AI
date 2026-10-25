import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { test, expect } from "@playwright/test";
import { createDb, schema } from "@mwezicare/db";
import { signUpAndOnboard, uniqueTestEmail } from "./helpers";

config({ path: "../../.env" });

const db = createDb(process.env.DATABASE_URL!);

test.describe("a verifier marking a facility's GYN service verified surfaces in (user)/care", () => {
  test("verify via the staff console, then find it as confirmed in Care", async ({
    page,
  }) => {
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

    await signUpAndOnboard(page, {
      email: uniqueTestEmail("facility-e2e"),
      county,
      consents: { location: true },
    });
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

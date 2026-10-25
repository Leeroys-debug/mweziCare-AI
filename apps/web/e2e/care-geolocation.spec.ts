import { config } from "dotenv";
import { eq, like } from "drizzle-orm";
import { test, expect } from "@playwright/test";
import { createDb, schema } from "@mwezicare/db";
import { signUpAndOnboard, uniqueTestEmail } from "./helpers";

config({ path: "../../.env" });

const db = createDb(process.env.DATABASE_URL!);

test.describe("Care tab with mocked geolocation", () => {
  test.beforeAll(async () => {
    const [verified] = await db
      .insert(schema.facilities)
      .values({
        kmhflCode: "E2E-CARE-VERIFIED",
        name: "E2E Verified Health Centre",
        county: "Kiambu",
        geom: { lat: -1.172, lng: 36.836 },
        phone: "+254700030001",
      })
      .onConflictDoUpdate({
        target: schema.facilities.kmhflCode,
        set: { name: "E2E Verified Health Centre" },
      })
      .returning({ id: schema.facilities.id });

    await db
      .insert(schema.facilityServices)
      .values({
        facilityId: verified!.id,
        serviceCode: "GYN",
        status: "verified",
        lastVerifiedAt: new Date(),
        source: "e2e-fixture",
      })
      .onConflictDoUpdate({
        target: [
          schema.facilityServices.facilityId,
          schema.facilityServices.serviceCode,
        ],
        set: { status: "verified", lastVerifiedAt: new Date() },
      });
  });

  test.afterAll(async () => {
    const facilities = await db
      .select({ id: schema.facilities.id })
      .from(schema.facilities)
      .where(like(schema.facilities.kmhflCode, "E2E-CARE-%"));
    for (const facility of facilities) {
      await db
        .delete(schema.referrals)
        .where(eq(schema.referrals.facilityId, facility.id));
    }
    await db
      .delete(schema.facilities)
      .where(like(schema.facilities.kmhflCode, "E2E-CARE-%"));
  });

  test("granting location finds the nearby verified facility, sorted by distance, with a working referral action", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: -1.1714, longitude: 36.8356 });

    const county = `Kiambu-care-e2e-${Date.now()}`;

    await signUpAndOnboard(page, {
      email: uniqueTestEmail("care-geo-e2e"),
      county,
      consents: { location: true },
    });
    await expect(page).toHaveURL(/\/en\/track$/, { timeout: 20000 });

    await page.goto("/en/care");
    await page.getByRole("button", { name: /share my location/i }).click();

    const card = page
      .getByTestId("facility-card")
      .filter({ hasText: "E2E Verified Health Centre" });
    await expect(card).toBeVisible({ timeout: 10000 });
    await expect(card.getByText(/gynaecology confirmed on/i)).toBeVisible();

    await card
      .getByRole("button", { name: /i contacted this facility/i })
      .click();
    await expect(card.getByRole("button", { name: /recorded/i })).toBeVisible();

    const [profile] = await db
      .select({ userId: schema.profiles.userId })
      .from(schema.profiles)
      .where(eq(schema.profiles.county, county));
    const referrals = await db
      .select()
      .from(schema.referrals)
      .where(eq(schema.referrals.userId, profile!.userId));
    expect(referrals).toHaveLength(1);
  });
});

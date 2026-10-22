import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { facilitiesSchema } from "./schemas";
import { serviceStatusEnum } from "./enums";
import { users } from "./identity";
import { geographyPoint } from "./custom-types";

export const facilities = facilitiesSchema.table(
  "facilities",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    kmhflCode: text("kmhfl_code").notNull().unique(),
    name: text("name").notNull(),
    county: text("county").notNull(),
    subCounty: text("sub_county"),
    geom: geographyPoint("geom"),
    phone: text("phone"),
    kephLevel: text("keph_level"),
    ownership: text("ownership"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("facilities_geom_idx").using("gist", table.geom),
    // pg_trgm — powers areaSearch's fuzzy name matching (packages/facilities).
    index("facilities_name_trgm_idx").using(
      "gin",
      table.name.op("gin_trgm_ops"),
    ),
  ],
);

/** Separates "listed in KMHFL" from "confirmed gynaecology". */
export const facilityServices = facilitiesSchema.table(
  "facility_services",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    facilityId: uuid("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    serviceCode: text("service_code").notNull(),
    status: serviceStatusEnum("status").notNull().default("listed"),
    verifiedBy: uuid("verified_by").references(() => users.id),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    source: text("source"),
    /** Free-text verifier notes from the most recent verification call. */
    notes: text("notes"),
    /**
     * The verifier's call-script checklist (staff console D2.3): phone
     * confirmed, gynaecology available, days/hours, referral needed, cost
     * info if reliable. Shape: { phoneConfirmed, gynAvailable, daysHours,
     * referralNeeded, costInfo }.
     */
    callScript: jsonb("call_script"),
  },
  (table) => [
    uniqueIndex("facility_services_facility_service_idx").on(
      table.facilityId,
      table.serviceCode,
    ),
  ],
);

/** Used for referral-completion indicators on the impact dashboard. */
export const referrals = facilitiesSchema.table("referrals", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  facilityId: uuid("facility_id")
    .notNull()
    .references(() => facilities.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  followUpStatus: text("follow_up_status"),
  followUpConsent: boolean("follow_up_consent").notNull().default(false),
});

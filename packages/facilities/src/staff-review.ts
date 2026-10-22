import { sql } from "drizzle-orm";
import { schema, type Database } from "@mwezicare/db";
import { eq, and } from "drizzle-orm";

const SIX_MONTHS_AGO = sql`now() - interval '6 months'`;

export interface CallScript {
  phoneConfirmed: boolean;
  gynAvailable: boolean;
  daysHours: string;
  referralNeeded: boolean;
  costInfo: string;
}

export interface StaffFacilityRow {
  id: string;
  kmhflCode: string;
  name: string;
  county: string;
  subCounty: string | null;
  phone: string | null;
  serviceCode: string;
  status: "listed" | "verified" | "unavailable";
  lastVerifiedAt: string | null;
  notes: string | null;
  callScript: CallScript | null;
  dueForReverification: boolean;
}

export interface StaffFacilityListParams {
  county?: string;
  status?: "listed" | "verified" | "unavailable";
  dueForReverificationOnly?: boolean;
  serviceCode?: string;
}

interface Row {
  id: string;
  kmhfl_code: string;
  name: string;
  county: string;
  sub_county: string | null;
  phone: string | null;
  service_code: string;
  status: "listed" | "verified" | "unavailable";
  last_verified_at: string | null;
  notes: string | null;
  call_script: CallScript | null;
  due_for_reverification: boolean;
}

function toStaffFacilityRow(row: Row): StaffFacilityRow {
  return {
    id: row.id,
    kmhflCode: row.kmhfl_code,
    name: row.name,
    county: row.county,
    subCounty: row.sub_county,
    phone: row.phone,
    serviceCode: row.service_code,
    status: row.status,
    lastVerifiedAt: row.last_verified_at,
    notes: row.notes,
    callScript: row.call_script,
    dueForReverification: row.due_for_reverification,
  };
}

/**
 * Facilities joined to one service row (default "GYN" — the only service
 * the Care tab tracks today), for the staff verifier console's table +
 * filters + re-verification queue. `dueForReverification` is true when
 * `last_verified_at` is null or older than 6 months.
 */
export async function listForStaffReview(
  db: Database,
  params: StaffFacilityListParams = {},
): Promise<StaffFacilityRow[]> {
  const serviceCode = params.serviceCode ?? "GYN";
  const countyFilter = params.county
    ? sql`and f.county = ${params.county}`
    : sql``;
  const statusFilter = params.status
    ? sql`and fs.status = ${params.status}`
    : sql``;
  const dueFilter = params.dueForReverificationOnly
    ? sql`and (fs.last_verified_at is null or fs.last_verified_at < ${SIX_MONTHS_AGO})`
    : sql``;

  const rows = (await db.execute(sql`
    select
      f.id, f.kmhfl_code, f.name, f.county, f.sub_county, f.phone,
      fs.service_code, fs.status, fs.last_verified_at, fs.notes, fs.call_script,
      (fs.last_verified_at is null or fs.last_verified_at < ${SIX_MONTHS_AGO}) as due_for_reverification
    from facilities.facilities f
    join facilities.facility_services fs on fs.facility_id = f.id and fs.service_code = ${serviceCode}
    where true ${countyFilter} ${statusFilter} ${dueFilter}
    order by f.name asc
  `)) as unknown as Row[];

  return rows.map(toStaffFacilityRow);
}

export async function getFacilityForStaffReview(
  db: Database,
  facilityId: string,
  serviceCode = "GYN",
): Promise<StaffFacilityRow | null> {
  const rows = (await db.execute(sql`
    select
      f.id, f.kmhfl_code, f.name, f.county, f.sub_county, f.phone,
      fs.service_code, fs.status, fs.last_verified_at, fs.notes, fs.call_script,
      (fs.last_verified_at is null or fs.last_verified_at < ${SIX_MONTHS_AGO}) as due_for_reverification
    from facilities.facilities f
    join facilities.facility_services fs on fs.facility_id = f.id and fs.service_code = ${serviceCode}
    where f.id = ${facilityId}
    limit 1
  `)) as unknown as Row[];

  const [row] = rows;
  return row ? toStaffFacilityRow(row) : null;
}

export interface VerifyFacilityServiceInput {
  facilityId: string;
  serviceCode?: string;
  status: "verified" | "unavailable";
  verifiedBy: string;
  notes: string;
  callScript: CallScript;
}

/** Records a verifier's call outcome — status/date/notes/checklist in one update. */
export async function verifyFacilityService(
  db: Database,
  input: VerifyFacilityServiceInput,
): Promise<void> {
  await db
    .update(schema.facilityServices)
    .set({
      status: input.status,
      verifiedBy: input.verifiedBy,
      lastVerifiedAt: new Date(),
      notes: input.notes,
      callScript: input.callScript,
      source: "staff-verification",
    })
    .where(
      and(
        eq(schema.facilityServices.facilityId, input.facilityId),
        eq(schema.facilityServices.serviceCode, input.serviceCode ?? "GYN"),
      ),
    );
}

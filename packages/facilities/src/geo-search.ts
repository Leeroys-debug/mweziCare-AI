import { sql } from "drizzle-orm";
import type { Database } from "@mwezicare/db";
import type {
  AreaSearchParams,
  FacilityResult,
  GeoSearchParams,
} from "./types";

interface FacilityRow {
  id: string;
  kmhfl_code: string;
  name: string;
  county: string;
  sub_county: string | null;
  lng: number | null;
  lat: number | null;
  phone: string | null;
  keph_level: string | null;
  ownership: string | null;
  distance_meters: number | null;
  services:
    | {
        service_code: string;
        status: string;
        last_verified_at: string | null;
      }[]
    | null;
}

function toFacilityResult(row: FacilityRow): FacilityResult {
  return {
    id: row.id,
    kmhflCode: row.kmhfl_code,
    name: row.name,
    county: row.county,
    subCounty: row.sub_county,
    lat: row.lat ?? 0,
    lng: row.lng ?? 0,
    phone: row.phone,
    kephLevel: row.keph_level,
    ownership: row.ownership,
    distanceMeters: row.distance_meters,
    services: (row.services ?? []).map((s) => ({
      serviceCode: s.service_code,
      status: s.status as FacilityResult["services"][number]["status"],
      lastVerifiedAt: s.last_verified_at,
    })),
  };
}

/** Services bundled per facility in one query (json_agg) — no N+1. */
const SERVICES_SUBQUERY = sql`
  coalesce(
    (
      select json_agg(json_build_object(
        'service_code', fs.service_code,
        'status', fs.status,
        'last_verified_at', fs.last_verified_at
      ))
      from facilities.facility_services fs
      where fs.facility_id = f.id
    ),
    '[]'
  )
`;

/** Nearest facilities within radiusKm, via ST_DWithin/ST_Distance on geography. */
export async function geoSearch(
  db: Database,
  params: GeoSearchParams,
): Promise<FacilityResult[]> {
  const radiusMetres = params.radiusKm * 1000;
  const limit = params.limit ?? 20;
  const serviceFilter = params.service
    ? sql`and exists (
        select 1 from facilities.facility_services fs2
        where fs2.facility_id = f.id and fs2.service_code = ${params.service}
        ${params.verifiedOnly ? sql`and fs2.status = 'verified'` : sql``}
      )`
    : sql``;

  const rows = (await db.execute(sql`
    select
      f.id, f.kmhfl_code, f.name, f.county, f.sub_county,
      ST_X(f.geom::geometry) as lng, ST_Y(f.geom::geometry) as lat,
      f.phone, f.keph_level, f.ownership,
      ST_Distance(f.geom, ST_MakePoint(${params.lng}, ${params.lat})::geography) as distance_meters,
      ${SERVICES_SUBQUERY} as services
    from facilities.facilities f
    where f.geom is not null
      and ST_DWithin(f.geom, ST_MakePoint(${params.lng}, ${params.lat})::geography, ${radiusMetres})
      ${serviceFilter}
    order by distance_meters asc
    limit ${limit}
  `)) as unknown as FacilityRow[];

  return rows.map(toFacilityResult);
}

/** Facility detail + its services, for GET /api/v1/facilities/:id. */
export async function getFacilityById(
  db: Database,
  id: string,
): Promise<FacilityResult | null> {
  const rows = (await db.execute(sql`
    select
      f.id, f.kmhfl_code, f.name, f.county, f.sub_county,
      ST_X(f.geom::geometry) as lng, ST_Y(f.geom::geometry) as lat,
      f.phone, f.keph_level, f.ownership,
      null::double precision as distance_meters,
      ${SERVICES_SUBQUERY} as services
    from facilities.facilities f
    where f.id = ${id}
    limit 1
  `)) as unknown as FacilityRow[];

  const [row] = rows;
  return row ? toFacilityResult(row) : null;
}

/** Manual county / free-text search, fuzzy-matched via pg_trgm. */
export async function areaSearch(
  db: Database,
  params: AreaSearchParams,
): Promise<FacilityResult[]> {
  const limit = params.limit ?? 20;
  const countyFilter = params.county
    ? sql`and f.county = ${params.county}`
    : sql``;
  const nameFilter = params.q ? sql`and f.name % ${params.q}` : sql``;
  const orderBy = params.q
    ? sql`similarity(f.name, ${params.q}) desc`
    : sql`f.name asc`;

  const rows = (await db.execute(sql`
    select
      f.id, f.kmhfl_code, f.name, f.county, f.sub_county,
      ST_X(f.geom::geometry) as lng, ST_Y(f.geom::geometry) as lat,
      f.phone, f.keph_level, f.ownership,
      null::double precision as distance_meters,
      ${SERVICES_SUBQUERY} as services
    from facilities.facilities f
    where true ${countyFilter} ${nameFilter}
    order by ${orderBy}
    limit ${limit}
  `)) as unknown as FacilityRow[];

  return rows.map(toFacilityResult);
}

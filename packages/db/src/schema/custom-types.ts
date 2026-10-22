import { customType } from "drizzle-orm/pg-core";

export interface GeoPoint {
  lng: number;
  lat: number;
}

/**
 * geography(Point,4326). Writes go through PostGIS's implicit text->geography
 * cast (WKT), so a plain parameterized INSERT/UPDATE works. Reads come back
 * as raw EWKB from the driver (it doesn't know PostGIS wire formats) — for
 * coordinates in a SELECT, use raw SQL (ST_AsGeoJSON / ST_X / ST_Y / ST_Distance)
 * the way packages/facilities' geo search does, not this column's JS value.
 */
export const geographyPoint = customType<{
  data: GeoPoint;
  driverData: string;
}>({
  dataType() {
    // NOTE: drizzle-kit only special-cases unquoting for "vector(...)"
    // (pgvector), not PostGIS types, so `generate` emits this as a quoted
    // identifier ("geography(Point,4326)") which Postgres rejects. Any
    // regenerated migration touching this column needs that quoting
    // manually stripped before it's applied — see drizzle/0000_*.sql.
    return "geography(Point,4326)";
  },
  toDriver(value) {
    return `POINT(${value.lng} ${value.lat})`;
  },
  fromDriver(value) {
    // Opaque EWKB passthrough — see doc comment above.
    return value as unknown as GeoPoint;
  },
});

/**
 * pgvector vector(1536) (OpenAI text-embedding-3-small dimensionality).
 * Round-trips through pgvector's text I/O format: "[0.1,0.2,...]".
 */
export const vector1536 = customType<{
  data: number[];
  driverData: string;
}>({
  dataType() {
    return "vector(1536)";
  },
  toDriver(value) {
    return `[${value.join(",")}]`;
  },
  fromDriver(value) {
    return value.slice(1, -1).split(",").filter(Boolean).map(Number);
  },
});

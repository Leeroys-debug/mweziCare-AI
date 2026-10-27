-- Hand-added (not drizzle-kit generated, no schema.ts change): matches
-- packages/facilities/src/geo-search.ts's areaSearch, which now searches
-- lower(f.name) so county/name search is case-insensitive — exact-case
-- matching was silently returning zero results for any casing other than
-- exactly what's stored. This expression index lets lower(name) % query
-- still use pg_trgm instead of a sequential scan once the facility
-- directory is real KMHFL-scale, not just a handful of seeded rows.
CREATE INDEX facilities_name_lower_trgm_idx
  ON facilities.facilities USING gin (lower(name) gin_trgm_ops);

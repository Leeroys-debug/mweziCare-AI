import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import type { FacilitySourceAdapter, RawFacilityRecord } from "../types";

interface CsvRow {
  kmhfl_code: string;
  name: string;
  county: string;
  sub_county?: string;
  lat: string;
  lng: string;
  phone?: string;
  keph_level?: string;
  ownership?: string;
  /** Semicolon-separated service codes, e.g. "GYN;OPD". */
  services?: string;
}

interface GeoJsonFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    kmhfl_code: string;
    name: string;
    county: string;
    sub_county?: string | null;
    phone?: string | null;
    keph_level?: string | null;
    ownership?: string | null;
    services?: string[];
  };
}

interface GeoJsonFeatureCollection {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
}

function parseCsv(content: string): RawFacilityRecord[] {
  const rows = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRow[];
  return rows.map((row) => ({
    kmhflCode: row.kmhfl_code,
    name: row.name,
    county: row.county,
    subCounty: row.sub_county || null,
    lat: Number(row.lat),
    lng: Number(row.lng),
    phone: row.phone || null,
    kephLevel: row.keph_level || null,
    ownership: row.ownership || null,
    services: (row.services ?? "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((serviceCode) => ({ serviceCode })),
  }));
}

function parseGeoJson(content: string): RawFacilityRecord[] {
  const collection = JSON.parse(content) as GeoJsonFeatureCollection;
  return collection.features.map((feature) => ({
    kmhflCode: feature.properties.kmhfl_code,
    name: feature.properties.name,
    county: feature.properties.county,
    subCounty: feature.properties.sub_county ?? null,
    lng: feature.geometry.coordinates[0],
    lat: feature.geometry.coordinates[1],
    phone: feature.properties.phone ?? null,
    kephLevel: feature.properties.keph_level ?? null,
    ownership: feature.properties.ownership ?? null,
    services: (feature.properties.services ?? []).map((serviceCode) => ({
      serviceCode,
    })),
  }));
}

/** Reads a manually downloaded KMHFL extract — CSV or GeoJSON, by file extension. */
export class FileAdapter implements FacilitySourceAdapter {
  constructor(private readonly filePath: string) {}

  async fetchFacilities(): Promise<RawFacilityRecord[]> {
    const ext = path.extname(this.filePath).toLowerCase();
    if (ext !== ".csv" && ext !== ".geojson" && ext !== ".json") {
      throw new Error(
        `Unsupported facility extract format: ${ext} (expected .csv or .geojson)`,
      );
    }
    const content = readFileSync(this.filePath, "utf8");
    if (ext === ".csv") return parseCsv(content);
    return parseGeoJson(content);
  }
}

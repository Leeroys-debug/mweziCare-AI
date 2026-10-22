export interface RawFacilityService {
  serviceCode: string;
}

export interface RawFacilityRecord {
  kmhflCode: string;
  name: string;
  county: string;
  subCounty?: string | null;
  lat: number;
  lng: number;
  phone?: string | null;
  kephLevel?: string | null;
  ownership?: string | null;
  services: RawFacilityService[];
}

/** A source of facility records — implemented by the file adapter (CSV/GeoJSON) and the KMHFL API adapter. */
export interface FacilitySourceAdapter {
  fetchFacilities(): Promise<RawFacilityRecord[]>;
}

export interface GeoSearchParams {
  lat: number;
  lng: number;
  radiusKm: number;
  /** e.g. "GYN" — restricts to facilities offering this service. */
  service?: string;
  /** Only facilities where that service's status is 'verified'. */
  verifiedOnly?: boolean;
  limit?: number;
}

export interface AreaSearchParams {
  county?: string;
  /** Free-text facility name query, matched fuzzily via pg_trgm. */
  q?: string;
  limit?: number;
}

export interface FacilityServiceResult {
  serviceCode: string;
  status: "listed" | "verified" | "unavailable";
  lastVerifiedAt: string | null;
}

export interface FacilityResult {
  id: string;
  kmhflCode: string;
  name: string;
  county: string;
  subCounty: string | null;
  lat: number;
  lng: number;
  phone: string | null;
  kephLevel: string | null;
  ownership: string | null;
  /** Metres from the query point — only present for geoSearch results. */
  distanceMeters: number | null;
  services: FacilityServiceResult[];
}

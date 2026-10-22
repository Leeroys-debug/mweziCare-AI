"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FacilityCardData } from "./facility-card";

// Free OSM raster tiles — no API key, no per-request fees (CLAUDE.md
// "data-light"; the architecture doc's "no per-request map fees").
const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

export interface FacilityMapProps {
  results: FacilityCardData[];
  center?: { lat: number; lng: number };
}

/** Only imported/rendered when the user opens the map view (next/dynamic, ssr:false) — see components/care/care-results.tsx. */
export function FacilityMap({ results, center }: FacilityMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const initialCenter = center ??
      results[0] ?? { lat: -1.2921, lng: 36.8219 };
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: [initialCenter.lng, initialCenter.lat],
      zoom: 12,
    });
    mapRef.current = map;
    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map is created once; markers sync in a separate effect
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers = results.map((facility) =>
      new maplibregl.Marker()
        .setLngLat([facility.lng, facility.lat])
        .setPopup(new maplibregl.Popup().setText(facility.name))
        .addTo(map),
    );
    return () => markers.forEach((m) => m.remove());
  }, [results]);

  return <div ref={containerRef} className="h-80 w-full rounded-lg" />;
}

export default FacilityMap;

"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Button, Skeleton } from "@mwezicare/ui";
import { FacilityList } from "@/components/care/facility-list";
import { LocationConsent } from "@/components/care/location-consent";
import { UrgentCareBanner } from "@/components/care/urgent-banner";
import type { FacilityCardData } from "@/components/care/facility-card";
import { OfflineBanner } from "@/components/offline-banner";

// Map tiles load only when the user opens this view (CLAUDE.md "data-light").
const FacilityMap = dynamic(() => import("@/components/care/facility-map"), {
  ssr: false,
  loading: () => <p className="text-sm text-neutral-500">Loading map…</p>,
});

interface SearchResponse {
  mode: "geo" | "area";
  results: FacilityCardData[];
}

interface AssessmentResponse {
  available: boolean;
  assessment?: { outcome: "routine" | "assess_soon" | "urgent" };
}

export default function CarePage() {
  const t = useTranslations("Care");
  const [view, setView] = useState<"list" | "map">("list");
  const [county, setCounty] = useState("");
  const [query, setQuery] = useState("");
  const [searchParams, setSearchParams] = useState<URLSearchParams | null>(
    null,
  );
  const [geoError, setGeoError] = useState<string | null>(null);

  const { data: assessmentData } = useQuery({
    queryKey: ["assessments"],
    queryFn: async (): Promise<AssessmentResponse> => {
      const response = await fetch("/api/v1/assessments");
      if (!response.ok) throw new Error("Failed to load assessment");
      return response.json() as Promise<AssessmentResponse>;
    },
  });

  const { data: searchData, isFetching } = useQuery({
    queryKey: ["facilities-search", searchParams?.toString()],
    queryFn: async (): Promise<SearchResponse> => {
      const response = await fetch(
        `/api/v1/facilities/search?${searchParams!.toString()}`,
      );
      if (!response.ok) throw new Error("Search failed");
      return response.json() as Promise<SearchResponse>;
    },
    enabled: searchParams != null,
  });

  function searchByLocation() {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError(t("geolocationUnsupported"));
      return;
    }
    // Coordinates live only in this request — never persisted (CLAUDE.md).
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const params = new URLSearchParams({
          lat: String(position.coords.latitude),
          lng: String(position.coords.longitude),
          radiusKm: "25",
          service: "GYN",
        });
        setSearchParams(params);
      },
      () => setGeoError(t("geolocationDenied")),
    );
  }

  function searchByArea(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (county) params.set("county", county);
    if (query) params.set("q", query);
    setSearchParams(params);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <OfflineBanner />

      {assessmentData?.assessment?.outcome === "urgent" && <UrgentCareBanner />}

      <LocationConsent onAllow={searchByLocation} />
      {geoError && <p className="text-sm text-red-600">{geoError}</p>}

      <form onSubmit={searchByArea} className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("countyLabel")}
          <input
            value={county}
            onChange={(e) => setCounty(e.target.value)}
            className="h-11 rounded-md border border-neutral-300 px-3 dark:border-neutral-700 dark:bg-neutral-900"
            placeholder={t("countyPlaceholder")}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("searchLabel")}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 rounded-md border border-neutral-300 px-3 dark:border-neutral-700 dark:bg-neutral-900"
            placeholder={t("searchPlaceholder")}
          />
        </label>
        <Button type="submit">{t("searchButton")}</Button>
      </form>

      {searchParams && (
        <>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-900">
            <Button
              type="button"
              variant={view === "list" ? "default" : "ghost"}
              onClick={() => setView("list")}
            >
              {t("listView")}
            </Button>
            <Button
              type="button"
              variant={view === "map" ? "default" : "ghost"}
              onClick={() => setView("map")}
            >
              {t("mapView")}
            </Button>
          </div>

          {isFetching ? (
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : view === "list" ? (
            <FacilityList
              results={searchData?.results ?? []}
              outcome={assessmentData?.assessment?.outcome}
            />
          ) : (
            <FacilityMap results={searchData?.results ?? []} />
          )}
        </>
      )}
    </div>
  );
}

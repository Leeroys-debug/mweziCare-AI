import { NextResponse } from "next/server";
import { areaSearch, geoSearch } from "@mwezicare/facilities";
import {
  areaSearchQuerySchema,
  geoSearchQuerySchema,
} from "@mwezicare/validation";
import { consumeRateLimitToken, track } from "@mwezicare/db";
import { getCurrentUser } from "@/lib/rbac";
import { analyticsKeyProvider, db } from "@/lib/server-db";
import { problem } from "@/lib/problem-details";

function verifiedCount(results: { services: { status: string }[] }[]): number {
  return results.filter((r) => r.services.some((s) => s.status === "verified"))
    .length;
}

/**
 * `?lat=&lng=&radiusKm=` for geo search (the user's coordinates are used
 * only for this query — never logged or persisted, CLAUDE.md), or
 * `?county=&q=` for manual area search.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return problem(401, "Sign in required");

  const params = Object.fromEntries(new URL(request.url).searchParams);

  // 60/hour — interactive search (typing a county/query, panning the map),
  // but each call hits PostGIS/DB directly, so still worth bounding. After
  // validation (same order as every other rate-limited route — chat,
  // assessments — validate first) so malformed requests 400 without a DB
  // round-trip.
  const checkRateLimit = async () => {
    const limit = await consumeRateLimitToken(
      db,
      `facility-search:${user.id}`,
      60,
      60 / 3600,
    );
    return limit.allowed
      ? null
      : problem(
          429,
          "Too many search requests — please wait a moment and try again",
        );
  };

  if (params.lat != null && params.lng != null) {
    const parsed = geoSearchQuerySchema.safeParse(params);
    if (!parsed.success)
      return problem(400, "Invalid search params", parsed.error.message);
    const rateLimitError = await checkRateLimit();
    if (rateLimitError) return rateLimitError;
    const results = await geoSearch(db, parsed.data);
    await track(db, {
      userId: user.id,
      eventType: "facility_search",
      props: {
        mode: "geo",
        resultCount: results.length,
        verifiedCount: verifiedCount(results),
      },
      analyticsKeyProvider,
    });
    return NextResponse.json({ mode: "geo", results });
  }

  const parsed = areaSearchQuerySchema.safeParse(params);
  if (!parsed.success)
    return problem(400, "Invalid search params", parsed.error.message);
  const rateLimitError = await checkRateLimit();
  if (rateLimitError) return rateLimitError;
  const results = await areaSearch(db, parsed.data);
  await track(db, {
    userId: user.id,
    eventType: "facility_search",
    props: {
      mode: "area",
      resultCount: results.length,
      verifiedCount: verifiedCount(results),
    },
    analyticsKeyProvider,
  });
  return NextResponse.json({ mode: "area", results });
}

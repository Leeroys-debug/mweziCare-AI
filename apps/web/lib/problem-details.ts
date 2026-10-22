import { NextResponse } from "next/server";

/** RFC 9457 problem-details error response (CLAUDE.md API conventions). */
export function problem(
  status: number,
  title: string,
  detail?: string,
): NextResponse {
  return NextResponse.json(
    {
      type: "about:blank",
      title,
      status,
      ...(detail ? { detail } : {}),
    },
    { status, headers: { "Content-Type": "application/problem+json" } },
  );
}

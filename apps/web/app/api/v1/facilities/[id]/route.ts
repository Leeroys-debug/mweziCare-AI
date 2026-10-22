import { NextResponse } from "next/server";
import { getFacilityById } from "@mwezicare/facilities";
import { getCurrentUser } from "@/lib/rbac";
import { db } from "@/lib/server-db";
import { problem } from "@/lib/problem-details";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return problem(401, "Sign in required");

  const { id } = await params;
  const facility = await getFacilityById(db, id);
  if (!facility) return problem(404, "Facility not found");

  return NextResponse.json({ facility });
}

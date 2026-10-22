import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { schema } from "@mwezicare/db";
import { requireApiRole } from "@/lib/rbac";
import { db } from "@/lib/server-db";

const STAFF_READ_ROLES = [
  "clinician",
  "programme_admin",
  "system_admin",
] as const;

/** Every KB article across both locales, for the staff list view. */
export async function GET() {
  const roleCheck = await requireApiRole([...STAFF_READ_ROLES]);
  if (!roleCheck.ok) return roleCheck.response;

  const documents = await db
    .select({
      id: schema.kbDocuments.id,
      locale: schema.kbDocuments.locale,
      slug: schema.kbDocuments.slug,
      title: schema.kbDocuments.title,
      status: schema.kbDocuments.status,
      reviewDue: schema.kbDocuments.reviewDue,
      updatedAt: schema.kbDocuments.updatedAt,
    })
    .from(schema.kbDocuments)
    .orderBy(asc(schema.kbDocuments.locale), asc(schema.kbDocuments.title));

  return NextResponse.json({ documents });
}

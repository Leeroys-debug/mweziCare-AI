import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { schema } from "@mwezicare/db";
import { getCurrentUser } from "@/lib/rbac";
import { db } from "@/lib/server-db";
import { problem } from "@/lib/problem-details";

/** Approved Learn articles for the requested locale — for the Track tab's insight carousel. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return problem(401, "Sign in required");

  const locale =
    new URL(request.url).searchParams.get("locale") === "sw" ? "sw" : "en";

  const articles = await db
    .select({ slug: schema.kbDocuments.slug, title: schema.kbDocuments.title })
    .from(schema.kbDocuments)
    .where(
      and(
        eq(schema.kbDocuments.locale, locale),
        eq(schema.kbDocuments.status, "approved"),
      ),
    )
    .orderBy(asc(schema.kbDocuments.title));

  return NextResponse.json({ articles });
}

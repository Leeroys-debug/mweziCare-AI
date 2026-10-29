import { eq } from "drizzle-orm";
import { listAllSymptomLogs, schema, withUser } from "@mwezicare/db";
import { deriveCycles } from "@mwezicare/triage";
import { loadMyDataPdfLabels } from "@/lib/i18n-labels";
import { renderMyDataPdf } from "@/lib/my-data-pdf";
import { getCurrentUser } from "@/lib/rbac";
import { encryptionKeyProvider, db } from "@/lib/server-db";
import { problem } from "@/lib/problem-details";

/**
 * A PDF instead of raw JSON — easier for a user to actually read or hand to
 * someone, and still covers everything the app holds about them. Cycles are
 * derived from the logs (deriveCycles), same as Insights/Track/the clinician
 * summary — health.cycles is never actually written to, so querying it
 * directly (as this route used to) always returned an empty list.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return problem(401, "Sign in required");

  const [profile] = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, user.id));

  const consents = await db
    .select()
    .from(schema.consents)
    .where(eq(schema.consents.userId, user.id));

  const { logs, assessments, summaries } = await withUser(
    db,
    user.id,
    async (tx) => {
      const [logs, assessments, summaries] = await Promise.all([
        listAllSymptomLogs(tx, user.id, encryptionKeyProvider),
        tx
          .select()
          .from(schema.assessments)
          .where(eq(schema.assessments.userId, user.id)),
        tx
          .select()
          .from(schema.summaries)
          .where(eq(schema.summaries.userId, user.id)),
      ]);
      return { logs, assessments, summaries };
    },
  );

  // A user downloading their own data isn't a staff access, so no
  // audit.access_log entry — that's reserved for staff reading user data.

  const locale = user.locale ?? "en";
  const labels = await loadMyDataPdfLabels(locale);
  const pdfBuffer = await renderMyDataPdf({
    exportedAt: new Date().toISOString(),
    locale,
    profile: profile
      ? {
          ageBand: profile.ageBand,
          county: profile.county,
          familyHistoryEndometriosis: profile.familyHistoryEndometriosis,
        }
      : null,
    consents,
    cycles: deriveCycles(logs),
    logs,
    assessments: assessments.map((a) => ({
      createdAt: a.createdAt,
      outcome: a.outcome,
      reasons: a.reasons as { en: string; sw: string }[],
      rulesetVersion: a.rulesetVersion,
    })),
    summaries,
    labels,
  });

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="mwezicare-data.pdf"',
    },
  });
}

import { randomBytes, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { schema, sha256Hex, track, withUser } from "@mwezicare/db";
import { summaryCreateSchema } from "@mwezicare/validation";
import { assertSameOrigin } from "@/lib/csrf";
import { loadSummaryPdfLabels } from "@/lib/i18n-labels";
import { putPdf } from "@/lib/object-storage";
import { problem } from "@/lib/problem-details";
import { getCurrentUser } from "@/lib/rbac";
import { analyticsKeyProvider, db } from "@/lib/server-db";
import { loadSummaryDataForUser } from "@/lib/summary-data";
import { renderSummaryPdf } from "@/lib/summary-pdf";

const SHARE_LINK_EXPIRY_HOURS = 72;

/**
 * Generates a clinician-summary PDF and an active share link in one step —
 * `health.summaries.share_token_hash` is NOT NULL, so there's no
 * "private-only" summary to create; the 'sharing' consent gate below covers
 * the whole flow (CLAUDE.md: "Require the 'sharing' consent before the
 * first share"). The raw token is returned once, here, and never stored —
 * only its hash is (see packages/db's sha256Hex).
 */
export async function POST(request: Request) {
  const csrfError = assertSameOrigin(request);
  if (csrfError) return csrfError;

  const user = await getCurrentUser();
  if (!user) return problem(401, "Sign in required");

  const body = await request.json().catch(() => null);
  const parsed = summaryCreateSchema.safeParse(body);
  if (!parsed.success)
    return problem(400, "Invalid summary request", parsed.error.message);

  const [sharingConsent] = await db
    .select()
    .from(schema.consents)
    .where(
      and(
        eq(schema.consents.userId, user.id),
        eq(schema.consents.purpose, "sharing"),
      ),
    )
    .orderBy(desc(schema.consents.version))
    .limit(1);
  if (!sharingConsent?.grantedAt || sharingConsent.withdrawnAt) {
    return problem(
      403,
      "Sharing consent required",
      "Grant the 'sharing' consent before generating a clinician summary — every summary creates a shareable link.",
    );
  }

  const [profile] = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, user.id));
  if (!profile) {
    return problem(
      400,
      "Profile required",
      "Complete onboarding before generating a summary.",
    );
  }

  const period =
    parsed.data.range === "custom"
      ? `custom:${parsed.data.from}..${parsed.data.to}`
      : parsed.data.range;
  const { data: summaryData } = await loadSummaryDataForUser(
    db,
    user.id,
    period,
  );

  const locale = user.locale ?? "en";
  const labels = await loadSummaryPdfLabels(locale);
  const pdfBuffer = await renderSummaryPdf(summaryData, {
    displayLabel: parsed.data.displayLabel,
    ageBand: profile.ageBand,
    familyHistoryEndometriosis: profile.familyHistoryEndometriosis,
    locale,
    labels,
  });

  const pdfKey = `summaries/${randomUUID()}.pdf`;
  await putPdf(pdfKey, pdfBuffer);

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(
    Date.now() + SHARE_LINK_EXPIRY_HOURS * 60 * 60 * 1000,
  );

  const [summary] = await withUser(db, user.id, (tx) =>
    tx
      .insert(schema.summaries)
      .values({
        userId: user.id,
        period,
        pdfKey,
        shareTokenHash: sha256Hex(token),
        expiresAt,
        viewCount: 0,
      })
      .returning(),
  );

  await track(db, {
    userId: user.id,
    eventType: "summary_created",
    props: {},
    analyticsKeyProvider,
  });

  return NextResponse.json({
    token,
    summary: {
      id: summary!.id,
      period: summary!.period,
      expiresAt: summary!.expiresAt,
      viewCount: summary!.viewCount,
    },
    // Returned so the creator's own page can preview immediately without a
    // second round-trip — the server already computed all of this.
    data: summaryData,
    labels,
    ageBand: profile.ageBand,
    familyHistoryEndometriosis: profile.familyHistoryEndometriosis,
  });
}

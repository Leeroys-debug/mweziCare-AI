import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import {
  consumeRateLimitToken,
  hmacLookup,
  schema,
  sha256Hex,
  track,
} from "@mwezicare/db";
import { Button } from "@mwezicare/ui";
import { SummaryView } from "@/components/summary/summary-view";
import { getClientIp } from "@/lib/client-ip";
import { loadSummaryPdfLabels, loadTranslator } from "@/lib/i18n-labels";
import { getPresignedDownloadUrl } from "@/lib/object-storage";
import { analyticsKeyProvider, db, hmacKeyProvider } from "@/lib/server-db";
import { loadSummaryDataForUser } from "@/lib/summary-data";

export const metadata = {
  robots: { index: false, follow: false },
};

/**
 * Public, unauthenticated share link. Rate-limited per IP (the same
 * Postgres-backed token bucket used elsewhere in this app), 404s on missing/expired/
 * revoked without distinguishing the reason (don't leak which), and
 * increments view_count on every successful view.
 */
export default async function SharedSummaryPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const headerList = await headers();
  const ipHash = hmacLookup(getClientIp(headerList), hmacKeyProvider);
  const rateLimit = await consumeRateLimitToken(
    db,
    `summary-view:ip:${ipHash}`,
    20,
    20 / 600,
  );
  if (!rateLimit.allowed) notFound();

  const tokenHash = sha256Hex(token);
  const [summary] = await db
    .select()
    .from(schema.summaries)
    .where(eq(schema.summaries.shareTokenHash, tokenHash));

  if (!summary || summary.revokedAt || summary.expiresAt < new Date()) {
    notFound();
  }

  await db
    .update(schema.summaries)
    .set({ viewCount: summary.viewCount + 1 })
    .where(eq(schema.summaries.id, summary.id));

  // Tracked against the summary OWNER, not the (unauthenticated) viewer —
  // this page has no session; "summary_viewed" measures how often a
  // person's own shared summaries get opened.
  await track(db, {
    userId: summary.userId,
    eventType: "summary_viewed",
    props: {},
    analyticsKeyProvider,
  });

  const [profile] = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, summary.userId));
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, summary.userId));
  const locale = user?.locale ?? "en";

  const { data } = await loadSummaryDataForUser(
    db,
    summary.userId,
    summary.period,
  );
  const labels = await loadSummaryPdfLabels(locale);
  const t = await loadTranslator(locale, "Summary");
  const downloadUrl = await getPresignedDownloadUrl(summary.pdfKey, 300);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-8">
      <SummaryView
        data={data}
        labels={labels}
        ageBand={profile?.ageBand ?? "unknown"}
        familyHistoryEndometriosis={profile?.familyHistoryEndometriosis ?? null}
        locale={locale}
      />
      <Button asChild size="lg">
        <a href={downloadUrl}>{t("downloadPdf")}</a>
      </Button>
    </main>
  );
}

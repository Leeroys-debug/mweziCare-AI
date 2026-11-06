import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import {
  consumeRateLimitToken,
  listTriageLogs,
  loadRuleset,
  schema,
  track,
  withUser,
} from "@mwezicare/db";
import { evaluate } from "@mwezicare/rules-engine";
import { extractRedFlagFeatures } from "@mwezicare/triage";
import { assertSameOrigin } from "@/lib/csrf";
import { getCurrentUser } from "@/lib/rbac";
import { analyticsKeyProvider, db } from "@/lib/server-db";
import { problem } from "@/lib/problem-details";

/**
 * Runs the triage evaluation against the currently APPROVED ruleset — the
 * only place (besides the client-side urgent pre-check) urgency is decided,
 * and the only one that writes the immutable system-of-record row (CLAUDE.md:
 * "Rules engine decides urgency, not the LLM"). If no ruleset has been
 * approved yet, reports unavailable rather than erroring — see
 * packages/rules-engine's draft-v1 ruleset, which intentionally stays
 * "draft" until a named clinician signs off.
 *
 * Currently evaluates only today's described symptoms (red-flag features),
 * not multi-cycle history/trend features — see the comment at the features
 * object below for why.
 */
export async function POST(request: Request) {
  const csrfError = assertSameOrigin(request);
  if (csrfError) return csrfError;

  const user = await getCurrentUser();
  if (!user) return problem(401, "Sign in required");

  // 30/hour — generous for genuine re-assessment after logging new
  // symptoms, cheap defense against scripted spam of this compute+write.
  const limit = await consumeRateLimitToken(
    db,
    `assessments:${user.id}`,
    30,
    30 / 3600,
  );
  if (!limit.allowed)
    return problem(
      429,
      "Too many assessment requests — please wait a moment and try again",
    );

  const ruleset = await loadRuleset(db, "approved");
  if (!ruleset) {
    return NextResponse.json({ available: false });
  }

  const logs = await withUser(db, user.id, (tx) => listTriageLogs(tx, user.id));
  const latestLog = logs.at(-1) ?? {};
  const redFlagFeatures = extractRedFlagFeatures(latestLog);

  // Product decision (not a clinical-safety rollback): for now, the
  // assessment is derived only from today's described symptoms
  // (redFlagFeatures above) — multi-cycle pattern tracking (worsening
  // trend, cycle-length variability, repeated disruption, etc.) is
  // deferred until that's actually built out. packages/triage's
  // extractFeatures/deriveCycles and every history-based rule in
  // packages/rules-engine/src/rulesets/draft-v1.ts stay fully implemented
  // and fixture-tested for when it's re-enabled — this route just doesn't
  // feed those features into evaluate() yet, so routine_baseline (and its
  // reassuring "that's good to hear" copy) is reached whenever today's
  // symptoms alone don't trip an urgent red flag.
  //
  // familyHistoryEndometriosis is also left out here, since its only
  // current rule (assess_soon_family_history_with_pain) requires the
  // history feature cyclesWithMaxPainGte7_last3 to fire alongside it.
  const features = {
    ...redFlagFeatures,
  };
  const { outcome, reasons, firedRules } = evaluate(ruleset, features);

  const assessment = await withUser(db, user.id, async (tx) => {
    const [row] = await tx
      .insert(schema.assessments)
      .values({
        userId: user.id,
        rulesetVersion: ruleset.version,
        outcome,
        reasons,
        firedRuleCodes: firedRules.map((rule) => rule.id),
        features,
      })
      .returning();
    return row;
  });

  await track(db, {
    userId: user.id,
    eventType: "assessment_generated",
    props: { outcome },
    analyticsKeyProvider,
  });

  return NextResponse.json({ available: true, assessment });
}

/** Most recently stored assessment, without recomputing — fast render for the Insights page. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return problem(401, "Sign in required");

  const assessment = await withUser(db, user.id, async (tx) => {
    const [row] = await tx
      .select()
      .from(schema.assessments)
      .where(eq(schema.assessments.userId, user.id))
      .orderBy(desc(schema.assessments.createdAt))
      .limit(1);
    return row ?? null;
  });

  if (!assessment) return NextResponse.json({ available: false });
  return NextResponse.json({ available: true, assessment });
}

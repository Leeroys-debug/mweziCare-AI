import { sql } from "drizzle-orm";
import { withStaffReview, type Database } from "@mwezicare/db";

const LIMIT = 200;

export interface CaseSampleRow {
  /** Opaque assessment id — never a name/phone/note, just a handle to submit a review against. */
  id: string;
  ageBand: string | null;
  county: string | null;
  outcome: "routine" | "assess_soon" | "urgent";
  firedRuleCodes: string[] | null;
  features: Record<string, unknown> | null;
  week: string;
  /** Latest clinician adjudication of this escalation's appropriateness, if any (health.assessment_reviews). */
  review: {
    verdict: "appropriate" | "inappropriate" | "uncertain";
    reviewedAt: string;
  } | null;
}

/**
 * De-identified recent assessments for clinician quality review (D2.4) —
 * age band, county, computed features, outcome and fired rule codes only,
 * never names/phones/notes/exact dates (createdAt is week-truncated). Reads
 * through withStaffReview (clinical/0008's staff-review RLS policy), which
 * is the only sanctioned way to see assessments across every user. Also
 * surfaces each assessment's id (an opaque handle, not PII) and its latest
 * review verdict, if any, for the urgent-escalation adjudication workflow
 * (health.assessment_reviews, UNICEF proposal §10's "safety of urgent
 * escalations" pilot metric).
 */
export async function listCaseSamples(db: Database): Promise<CaseSampleRow[]> {
  return withStaffReview(db, async (tx) => {
    const rows = await tx.execute(sql`
      select
        a.id as id,
        p.age_band as "ageBand",
        p.county as county,
        a.outcome as outcome,
        a.fired_rule_codes as "firedRuleCodes",
        a.features as features,
        date_trunc('week', a.created_at) as week,
        r.verdict as "reviewVerdict",
        r.created_at as "reviewedAt"
      from health.assessments a
      left join identity.profiles p on p.user_id = a.user_id
      left join lateral (
        select ar.verdict, ar.created_at
        from health.assessment_reviews ar
        where ar.assessment_id = a.id
        order by ar.created_at desc
        limit 1
      ) r on true
      order by a.created_at desc
      limit ${LIMIT}
    `);
    interface RawRow {
      id: string;
      ageBand: string | null;
      county: string | null;
      outcome: "routine" | "assess_soon" | "urgent";
      firedRuleCodes: string[] | null;
      features: Record<string, unknown> | null;
      week: string;
      reviewVerdict: "appropriate" | "inappropriate" | "uncertain" | null;
      reviewedAt: string | null;
    }

    return (rows as unknown as RawRow[]).map(
      ({ reviewVerdict, reviewedAt, ...row }) => ({
        ...row,
        review: reviewVerdict
          ? { verdict: reviewVerdict, reviewedAt: reviewedAt! }
          : null,
      }),
    );
  });
}

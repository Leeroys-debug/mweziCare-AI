import { sql } from "drizzle-orm";
import { withStaffReview, type Database } from "@mwezicare/db";

const LIMIT = 200;

export interface CaseSampleRow {
  ageBand: string | null;
  county: string | null;
  outcome: "routine" | "assess_soon" | "urgent";
  firedRuleCodes: string[] | null;
  features: Record<string, unknown> | null;
  week: string;
}

/**
 * De-identified recent assessments for clinician quality review (D2.4) —
 * age band, county, computed features, outcome and fired rule codes only,
 * never names/phones/notes/exact dates (createdAt is week-truncated). Reads
 * through withStaffReview (clinical/0008's staff-review RLS policy), which
 * is the only sanctioned way to see assessments across every user.
 */
export async function listCaseSamples(db: Database): Promise<CaseSampleRow[]> {
  return withStaffReview(db, async (tx) => {
    const rows = await tx.execute(sql`
      select
        p.age_band as "ageBand",
        p.county as county,
        a.outcome as outcome,
        a.fired_rule_codes as "firedRuleCodes",
        a.features as features,
        date_trunc('week', a.created_at) as week
      from health.assessments a
      left join identity.profiles p on p.user_id = a.user_id
      order by a.created_at desc
      limit ${LIMIT}
    `);
    return rows as unknown as CaseSampleRow[];
  });
}

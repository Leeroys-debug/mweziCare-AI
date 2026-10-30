import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { draftRuleset } from "@mwezicare/rules-engine";
import { createDb } from "./client";
import * as schema from "./schema";

config({ path: "../../.env" });

// Deterministic PRNG so repeated `pnpm db:seed` runs produce the same
// synthetic dataset (mulberry32 — small, no dependency).
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(42);
const randInt = (min: number, max: number) =>
  Math.floor(rng() * (max - min + 1)) + min;
const pick = <T>(arr: T[]): T => arr[randInt(0, arr.length - 1)] as T;

const KIAMBU_SUB_COUNTIES = [
  "Kiambu",
  "Thika",
  "Ruiru",
  "Juja",
  "Githunguri",
  "Kikuyu",
  "Limuru",
  "Lari",
  "Gatundu North",
  "Gatundu South",
  "Kabete",
];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to seed");
  }

  const db = createDb(databaseUrl);

  console.log("Clearing previously seeded synthetic data...");
  // Safe to truncate unconditionally: this database only ever holds
  // synthetic/test data — see CLAUDE.md "Synthetic data only".
  await db.execute(sql`
    truncate table
      health.chat_messages, health.chat_sessions, health.summaries,
      health.assessments, health.symptom_logs, health.cycles, health.quiz_attempts,
      clinical.rules, clinical.rulesets,
      facilities.referrals, facilities.facility_services, facilities.facilities,
      identity.consents, identity.profiles, identity.users,
      analytics.events
    cascade
  `);

  console.log("Seeding users...");
  const ageBands = ["16-17", "18-20", "21-24"] as const;
  const counties = ["Kiambu", "Nairobi", "Kiambu"];
  const userRows = await db
    .insert(schema.users)
    .values(
      [1, 2, 3].map((n) => ({
        // Clearly-fake synthetic test data only.
        email: `seed-user-${n}@example.com`,
        emailVerified: true,
        role: "user" as const,
        locale: n === 2 ? "sw" : "en",
      })),
    )
    .returning({ id: schema.users.id });

  await db.insert(schema.profiles).values(
    userRows.map((u, i) => ({
      userId: u.id,
      ageBand: ageBands[i] ?? "18-20",
      county: counties[i] ?? "Kiambu",
      consentVersion: 1,
      // Only the "concerning" user (userRows[0], see below) — demonstrates
      // assess_soon_family_history_with_pain without making every synthetic
      // user trigger it.
      familyHistoryEndometriosis: u.id === userRows[0]?.id,
    })),
  );

  await db.insert(schema.consents).values(
    userRows.flatMap((u) => [
      {
        userId: u.id,
        purpose: "tracking" as const,
        version: 1,
        grantedAt: new Date(),
      },
      {
        userId: u.id,
        purpose: "location" as const,
        version: 1,
        grantedAt: new Date(),
      },
    ]),
  );

  console.log("Seeding 6 months of symptom logs per user...");
  const today = new Date();
  const DAYS = 182; // ~6 months
  for (const user of userRows) {
    const cycleLength = randInt(26, 32);
    const periodLength = randInt(3, 6);
    // One user gets a consistently concerning pattern (for assess_soon /
    // urgent fixtures later); the others get mostly-routine patterns.
    const concerning = user.id === userRows[0]?.id;

    const logs: (typeof schema.symptomLogs.$inferInsert)[] = [];
    for (let dayOffset = DAYS; dayOffset >= 0; dayOffset--) {
      const date = new Date(today);
      date.setDate(date.getDate() - dayOffset);
      const dayInCycle = (DAYS - dayOffset) % cycleLength;
      const onPeriod = dayInCycle < periodLength;
      if (!onPeriod && rng() > 0.15) continue; // sparse non-period logging

      const basePain = concerning ? randInt(5, 9) : randInt(0, 5);
      logs.push({
        userId: user.id,
        logDate: date.toISOString().slice(0, 10),
        periodDay: onPeriod,
        bleedingLevel: onPeriod
          ? pick(["light", "medium", "heavy", "very_heavy"] as const)
          : "none",
        painScore: onPeriod ? basePain : Math.max(0, basePain - 3),
        painLocations: onPeriod ? ["lower_abdomen"] : [],
        symptoms: {
          fatigue: onPeriod && rng() > 0.5,
          nausea: rng() > 0.8,
          painWithBowelMovements: onPeriod && concerning && rng() > 0.7,
          painWithUrination: onPeriod && concerning && rng() > 0.8,
          bloodInUrine: onPeriod && concerning && rng() > 0.9,
        },
        impact: {
          missedSchool: onPeriod && concerning && rng() > 0.4,
          missedWork: false,
          sleepDisrupted: onPeriod && rng() > 0.6,
          activitiesLimited: onPeriod && concerning && rng() > 0.5,
        },
        redFlags: {
          suddenSeverePain: false,
          fainting: false,
          possiblePregnancySuspected: false,
        },
        clientId: `seed-${user.id}-${date.toISOString().slice(0, 10)}`,
        syncedAt: new Date(),
      });
    }
    if (logs.length > 0) {
      await db.insert(schema.symptomLogs).values(logs);
    }
  }

  console.log("Seeding the draft ruleset from @mwezicare/rules-engine...");
  // Status stays "draft" — CLAUDE.md: no clinical content ships as approved
  // without a named clinician sign-off. POST /api/v1/assessments correctly
  // reports "not available yet" until someone flips a ruleset to "approved".
  const [ruleset] = await db
    .insert(schema.rulesets)
    .values({ version: draftRuleset.version, status: draftRuleset.status })
    .returning({ id: schema.rulesets.id });
  if (ruleset) {
    await db.insert(schema.rules).values(
      draftRuleset.rules.map((rule, i) => ({
        rulesetId: ruleset.id,
        code: rule.id,
        priority: rule.priority,
        outcome: rule.outcome,
        definition: rule.conditions,
        reasonEn: rule.reason.en,
        reasonSw: rule.reason.sw,
        clinicianNote: rule.clinicianNote,
        sortOrder: i,
      })),
    );
  }

  console.log("Seeding 20 synthetic facilities in Kiambu County...");
  // Synthetic placeholder entries for local development only — not real
  // KMHFL data. Coordinates are randomised within Kiambu County's rough
  // bounding box; phone numbers are obviously fake.
  const facilityRows = Array.from({ length: 20 }, (_, i) => {
    const subCounty = pick(KIAMBU_SUB_COUNTIES);
    return {
      kmhflCode: `TEST-KMHFL-${String(i + 1).padStart(4, "0")}`,
      name: `${subCounty} Test Health Centre ${i + 1}`,
      county: "Kiambu",
      subCounty,
      geom: {
        lng: 36.6 + rng() * 0.6,
        lat: -1.3 + rng() * 0.4,
      },
      phone: `+25470010${String(i).padStart(4, "0")}`,
      kephLevel: pick(["Level 2", "Level 3", "Level 4", "Level 5"]),
      ownership: pick(["public", "faith-based", "private"]),
    };
  });
  const insertedFacilities = await db
    .insert(schema.facilities)
    .values(facilityRows)
    .returning({ id: schema.facilities.id });

  await db.insert(schema.facilityServices).values(
    insertedFacilities.map((f, i) => ({
      facilityId: f.id,
      serviceCode: "GYN",
      status: i % 3 === 0 ? ("verified" as const) : ("listed" as const),
      lastVerifiedAt: i % 3 === 0 ? new Date() : null,
      source:
        i % 3 === 0 ? "seed: manual test verification" : "seed: KMHFL extract",
    })),
  );

  console.log("Seeding synthetic analytics events for the impact dashboard...");
  // Fake pseudo ids, not tied to the 3 real seeded users above — analytics
  // events never need a real user to exist (no FK on pseudo_id, by design:
  // CLAUDE.md "never joining identity"). 15 distinct pseudo ids per
  // (county, age_band) comfortably clears every materialised view's >= 10
  // distinct-pseudo-id suppression threshold, so the dashboard actually
  // shows data rather than "<10" placeholders everywhere.
  const ANALYTICS_COUNTIES = ["Kiambu", "Nairobi"];
  const ANALYTICS_AGE_BANDS = ["16-17", "18-20", "21-24"];
  const ANALYTICS_LOCALES = ["en", "sw"];
  const WEEKS_OF_HISTORY = 8;
  const PSEUDO_USERS_PER_CELL = 15;
  const OUTCOMES = ["routine", "assess_soon", "urgent"] as const;

  function weekStart(weeksAgo: number): Date {
    const date = new Date();
    date.setDate(date.getDate() - weeksAgo * 7 - date.getDay()); // Sunday of that week
    date.setHours(12, 0, 0, 0);
    return date;
  }

  const analyticsEvents: (typeof schema.events.$inferInsert)[] = [];

  for (const county of ANALYTICS_COUNTIES) {
    for (const ageBand of ANALYTICS_AGE_BANDS) {
      const pseudoIds = Array.from(
        { length: PSEUDO_USERS_PER_CELL },
        (_, i) => `seed-pseudo-${county}-${ageBand}-${i}`,
      );

      for (let weeksAgo = 0; weeksAgo < WEEKS_OF_HISTORY; weeksAgo++) {
        const occurredAt = weekStart(weeksAgo);

        for (const pseudoId of pseudoIds) {
          // Not every pseudo user is active every week — sparser than
          // real data would ever be, but enough variation for the trend
          // line/bar charts to look like something.
          if (rng() > 0.7) continue;

          const locale = pick(ANALYTICS_LOCALES);
          const common = { county, ageBand, locale, occurredAt };

          analyticsEvents.push({
            pseudoId,
            eventType: "log_saved",
            props: {},
            ...common,
          });

          if (rng() > 0.6) {
            const outcome = pick([...OUTCOMES]);
            analyticsEvents.push({
              pseudoId,
              eventType: "assessment_generated",
              props: { outcome },
              ...common,
            });
            if (outcome !== "routine" && rng() > 0.5) {
              analyticsEvents.push({
                pseudoId,
                eventType: "referral_recorded",
                props: { outcome },
                ...common,
              });
            }
          }

          if (rng() > 0.8) {
            analyticsEvents.push({
              pseudoId,
              eventType: "facility_search",
              props: {
                mode: pick(["geo", "area"] as const),
                resultCount: randInt(0, 10),
                verifiedCount: randInt(0, 5),
              },
              ...common,
            });
          }

          if (rng() > 0.85) {
            analyticsEvents.push({
              pseudoId,
              eventType: "chat_message",
              props: { inScope: rng() > 0.2 },
              ...common,
            });
          }
        }

        // One knowledge_quiz_completed "day30" event per cell per week, so
        // mv_knowledge_score_change has something to show.
        analyticsEvents.push({
          pseudoId: pick(pseudoIds),
          eventType: "knowledge_quiz_completed",
          props: {
            scoreBand: pick(["0-2", "3-4", "5"] as const),
            promptKind: "day30",
            scoreChangeBand: pick(["improved", "same", "declined"] as const),
          },
          county,
          ageBand,
          locale: pick(ANALYTICS_LOCALES),
          occurredAt,
        });
      }
    }
  }

  // Batched insert — thousands of rows in one go is fine for a seed script.
  const BATCH_SIZE = 500;
  for (let i = 0; i < analyticsEvents.length; i += BATCH_SIZE) {
    await db
      .insert(schema.events)
      .values(analyticsEvents.slice(i, i + BATCH_SIZE));
  }

  console.log(
    `Refreshing impact-dashboard materialised views (${analyticsEvents.length} synthetic events)...`,
  );
  for (const view of [
    "analytics.mv_weekly_county_age",
    "analytics.mv_weekly_active_users",
    "analytics.mv_logs_per_active_user",
    "analytics.mv_outcome_distribution",
    "analytics.mv_referrals_per_outcome",
    "analytics.mv_knowledge_score_change",
    "analytics.mv_language_split",
    "analytics.mv_referral_follow_up_rate",
  ]) {
    await db.execute(sql.raw(`REFRESH MATERIALIZED VIEW ${view}`));
  }

  console.log(
    "Seed complete: 3 users, ~6mo symptom logs, 1 draft ruleset, 20 facilities, synthetic analytics events.",
  );
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

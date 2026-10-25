import type { Ruleset } from "../dsl";

/**
 * [CLINICAL REVIEW REQUIRED]
 * Seeded DRAFT ruleset — mirrors the proposal's guidance table. Every
 * reason/clinicianNote is a placeholder until a named clinician signs off
 * (CLAUDE.md "No clinical content as final"). Stays `status: "draft"`;
 * packages/db/src/seed.ts inserts it as-is, and POST /api/v1/assessments
 * only ever evaluates against a ruleset whose DB row has been manually
 * flipped to `status: "approved"`.
 *
 * Feature names referenced here are produced by packages/triage:
 * - Single-log red-flag features (extractRedFlagFeatures): suddenSeverePain,
 *   fainting, possiblePregnancySuspected, painScore.
 * - History features (extractFeatures), each suffixed _last3/_last6:
 *   missedSchoolOrWorkOrSleepOrActivityDays, painTrendSlope,
 *   painDaysOutsideMenstruation, anyPainWithBowelOrUrination,
 *   heavyOrVeryHeavyBleedingDays, periodsLongerThan7Days,
 *   bleedingBetweenPeriods.
 */
export const draftRuleset: Ruleset = {
  version: 1,
  status: "draft",
  rules: [
    {
      id: "urgent_sudden_severe_pain",
      version: 1,
      priority: 100,
      outcome: "urgent",
      conditions: { feature: "suddenSeverePain", operator: "eq", value: true },
      reason: {
        en: "[CLINICAL REVIEW REQUIRED] You reported sudden, severe pelvic pain. Seek urgent care now.",
        sw: "[CLINICAL REVIEW REQUIRED][TRANSLATION REVIEW REQUIRED] Umeripoti maumivu makali ya ghafla ya nyonga. Tafuta huduma ya dharura sasa.",
      },
      clinicianNote:
        "[CLINICAL REVIEW REQUIRED] Threshold and wording for sudden severe pelvic pain pending clinician sign-off.",
    },
    {
      id: "urgent_fainting",
      version: 1,
      priority: 99,
      outcome: "urgent",
      conditions: { feature: "fainting", operator: "eq", value: true },
      reason: {
        en: "[CLINICAL REVIEW REQUIRED] You reported fainting. Seek urgent care now.",
        sw: "[CLINICAL REVIEW REQUIRED][TRANSLATION REVIEW REQUIRED] Umeripoti kuzimia. Tafuta huduma ya dharura sasa.",
      },
      clinicianNote:
        "[CLINICAL REVIEW REQUIRED] Confirm fainting alone (vs. with other symptoms) always warrants urgent, not assess_soon.",
    },
    {
      id: "urgent_possible_pregnancy_with_severe_pain",
      version: 1,
      priority: 98,
      outcome: "urgent",
      conditions: {
        all: [
          {
            feature: "possiblePregnancySuspected",
            operator: "eq",
            value: true,
          },
          { feature: "painScore", operator: "gte", value: 7 },
        ],
      },
      reason: {
        en: "[CLINICAL REVIEW REQUIRED] Severe pain with possible pregnancy needs urgent care now.",
        sw: "[CLINICAL REVIEW REQUIRED][TRANSLATION REVIEW REQUIRED] Maumivu makali pamoja na uwezekano wa ujauzito yanahitaji huduma ya dharura sasa.",
      },
      clinicianNote:
        "[CLINICAL REVIEW REQUIRED] Confirm the painScore>=7 threshold for this combination with a clinician.",
    },
    {
      id: "assess_soon_repeated_disruption",
      version: 1,
      priority: 50,
      outcome: "assess_soon",
      conditions: {
        feature: "missedSchoolOrWorkOrSleepOrActivityDays_last3",
        operator: "gte",
        value: 3,
      },
      reason: {
        en: "[CLINICAL REVIEW REQUIRED] Pain has repeatedly stopped you from school, work, sleep or activities in your last 3 cycles.",
        sw: "[CLINICAL REVIEW REQUIRED][TRANSLATION REVIEW REQUIRED] Maumivu yamekuwa yakikuzuia shuleni, kazini, kulala au shughuli mara kadhaa katika mizunguko 3 iliyopita.",
      },
      clinicianNote:
        "[CLINICAL REVIEW REQUIRED] Confirm the >=3-days-in-3-cycles threshold. " +
        'Cf. NICE NG73 1.3.1 — "period-related pain (dysmenorrhoea) affecting ' +
        'daily activities and quality of life" is listed as a symptom to ' +
        "suspect endometriosis on; the specific 3-cycle/3-day count is this " +
        "app's own placeholder, not NG73's, and still needs sign-off.",
    },
    {
      id: "assess_soon_worsening_cramps",
      version: 1,
      priority: 49,
      outcome: "assess_soon",
      conditions: {
        feature: "painTrendSlope_last3",
        operator: "gt",
        value: 0.5,
      },
      reason: {
        en: "[CLINICAL REVIEW REQUIRED] Your cramps appear to be getting worse over your recent cycles.",
        sw: "[CLINICAL REVIEW REQUIRED][TRANSLATION REVIEW REQUIRED] Maumivu yako ya hedhi yanaonekana kuzidi kuwa makali katika mizunguko ya hivi karibuni.",
      },
      clinicianNote:
        "[CLINICAL REVIEW REQUIRED] Confirm the slope threshold of 0.5.",
    },
    {
      id: "assess_soon_pain_between_periods",
      version: 1,
      priority: 48,
      outcome: "assess_soon",
      conditions: {
        feature: "painDaysOutsideMenstruation_last3",
        operator: "gt",
        value: 0,
      },
      reason: {
        en: "[CLINICAL REVIEW REQUIRED] You've had pelvic pain between periods.",
        sw: "[CLINICAL REVIEW REQUIRED][TRANSLATION REVIEW REQUIRED] Umekuwa na maumivu ya nyonga kati ya hedhi.",
      },
      clinicianNote:
        "[CLINICAL REVIEW REQUIRED] Confirm any pain-day count vs. a minimum. " +
        "Cf. NICE NG73 (Endometriosis: diagnosis and management) 1.3.1 — " +
        "chronic pelvic pain is listed as a symptom to suspect endometriosis on.",
    },
    {
      id: "assess_soon_pain_with_bowel_or_urination",
      version: 1,
      priority: 47,
      outcome: "assess_soon",
      conditions: {
        feature: "anyPainWithBowelOrUrination_last3",
        operator: "eq",
        value: true,
      },
      reason: {
        en: "[CLINICAL REVIEW REQUIRED] You've had pain with bowel movements or urination.",
        sw: "[CLINICAL REVIEW REQUIRED][TRANSLATION REVIEW REQUIRED] Umekuwa na maumivu wakati wa haja kubwa au haja ndogo.",
      },
      clinicianNote:
        "[CLINICAL REVIEW REQUIRED] Confirm this should be assess_soon, not urgent. " +
        'Cf. NICE NG73 1.3.1 — "period-related or cyclical gastrointestinal ' +
        'symptoms, in particular, painful bowel movements" and "period-related ' +
        "or cyclical urinary symptoms, in particular, blood in the urine or pain " +
        'passing urine" are both listed as symptoms to suspect endometriosis on.',
    },
    {
      id: "assess_soon_heavy_or_prolonged_bleeding",
      version: 1,
      priority: 46,
      outcome: "assess_soon",
      conditions: {
        any: [
          {
            feature: "heavyOrVeryHeavyBleedingDays_last3",
            operator: "gte",
            value: 2,
          },
          {
            feature: "periodsLongerThan7Days_last6",
            operator: "gte",
            value: 1,
          },
        ],
      },
      reason: {
        en: "[CLINICAL REVIEW REQUIRED] Your recent bleeding has been unusually heavy or has lasted longer than 7 days.",
        sw: "[CLINICAL REVIEW REQUIRED][TRANSLATION REVIEW REQUIRED] Damu ya hedhi ya hivi karibuni imekuwa nyingi kupita kiasi au imedumu zaidi ya siku 7.",
      },
      clinicianNote:
        "[CLINICAL REVIEW REQUIRED] Confirm the >=2-heavy-days and >=1-period->7-days thresholds. " +
        "Cf. NICE NG88 (Heavy menstrual bleeding: assessment and management) — " +
        "NG88 deliberately defines HMB by impact on quality of life rather than a " +
        "blood-loss volume/day-count threshold (1.1.1, 1.2.1); any specific day " +
        "counts here are this app's own placeholder, not NG88's, and need a " +
        "clinician's explicit sign-off, not just alignment with NG88's framing.",
    },
    {
      id: "assess_soon_repeated_bleeding_between_periods",
      version: 1,
      priority: 45,
      outcome: "assess_soon",
      conditions: {
        feature: "bleedingBetweenPeriods_last3",
        operator: "eq",
        value: true,
      },
      reason: {
        en: "[CLINICAL REVIEW REQUIRED] You've had repeated bleeding between periods.",
        sw: "[CLINICAL REVIEW REQUIRED][TRANSLATION REVIEW REQUIRED] Umekuwa na damu kati ya hedhi mara kadhaa.",
      },
      clinicianNote:
        "[CLINICAL REVIEW REQUIRED] Confirm 'repeated' vs. a single occurrence. " +
        "Cf. NICE NG88 1.2.1 and QS47 statement 1 — persistent intermenstrual " +
        "bleeding is listed as a symptom that may suggest uterine cavity " +
        "abnormality, histological abnormality, adenomyosis or fibroids.",
    },
    {
      id: "routine_baseline",
      version: 1,
      priority: 0,
      outcome: "routine",
      conditions: { all: [] },
      reason: {
        en: "[CLINICAL REVIEW REQUIRED] Your cramps look mild to moderate and aren't disrupting your life. Self-care tips are in Learn — keep tracking.",
        sw: "[CLINICAL REVIEW REQUIRED][TRANSLATION REVIEW REQUIRED] Maumivu yako ya hedhi yanaonekana kuwa madogo hadi ya wastani na hayakuzuii maisha yako. Vidokezo vya kujitunza viko kwenye Jifunze — endelea kufuatilia.",
      },
      clinicianNote: "[CLINICAL REVIEW REQUIRED] Confirm self-care copy.",
    },
  ],
};

/**
 * Just the urgent rules, for the client-side offline pre-check that runs
 * immediately after a log is saved (works with no network/DB — see
 * apps/web's urgent-care-overlay). Not the system of record; the real
 * immutable health.assessments row is still written server-side once synced.
 */
export const urgentOnlyRuleset: Ruleset = {
  ...draftRuleset,
  rules: draftRuleset.rules.filter((rule) => rule.outcome === "urgent"),
};

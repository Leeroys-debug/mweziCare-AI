/**
 * One-time (re-runnable) generator for packages/triage/src/fixtures/*.json —
 * synthetic case histories used by fixtures.test.ts to pin the full
 * extractFeatures -> evaluate pipeline against @mwezicare/rules-engine's
 * draft ruleset. Re-run with `npx tsx scripts/generate-fixtures.ts` after
 * changing the scenario list below; the committed JSON files are what the
 * test actually reads; this script is a dev convenience, not shipped.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { TriageLog } from "../src/features";

interface HistoryOptions {
  cycles: number;
  cycleLength: number;
  periodLength: number;
  startDate: string;
  basePain: number;
  nonPeriodPain?: number;
  painSlopePerCycle?: number;
  bleedingLevel?: TriageLog["bleedingLevel"];
  heavyBleedingLastNDays?: number;
  impactDaysPerCycle?: number;
  bowelOrUrinationOnLastPeriod?: "bowel" | "urination" | "both" | "none";
  painBetweenPeriodsDays?: number;
  bleedingBetweenPeriodsDays?: number;
  finalLogOverride?: Partial<TriageLog>;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
function addDays(iso: string, days: number): string {
  return new Date(
    new Date(`${iso}T00:00:00.000Z`).getTime() + days * MS_PER_DAY,
  )
    .toISOString()
    .slice(0, 10);
}

function buildHistory(opts: HistoryOptions): TriageLog[] {
  const logs: TriageLog[] = [];

  for (let cycleIndex = 0; cycleIndex < opts.cycles; cycleIndex++) {
    const isLastCycle = cycleIndex === opts.cycles - 1;
    const periodStart = addDays(opts.startDate, cycleIndex * opts.cycleLength);
    const pain = opts.basePain + (opts.painSlopePerCycle ?? 0) * cycleIndex;

    for (let offset = 0; offset < opts.periodLength; offset++) {
      const useHeavy =
        isLastCycle &&
        opts.heavyBleedingLastNDays != null &&
        offset < opts.heavyBleedingLastNDays;
      const bowelOrUrination = isLastCycle
        ? opts.bowelOrUrinationOnLastPeriod
        : undefined;

      logs.push({
        logDate: addDays(periodStart, offset),
        periodDay: true,
        bleedingLevel: useHeavy ? "heavy" : (opts.bleedingLevel ?? "light"),
        painScore: Math.max(0, Math.min(10, Math.round(pain))),
        painLocations: ["lower_abdomen"],
        symptoms: {
          painWithBowelMovements:
            bowelOrUrination === "bowel" || bowelOrUrination === "both",
          painWithUrination:
            bowelOrUrination === "urination" || bowelOrUrination === "both",
        },
        impact: {
          missedSchool: offset < (opts.impactDaysPerCycle ?? 0),
          missedWork: false,
          sleepDisrupted: false,
          activitiesLimited: false,
        },
        redFlags: {
          suddenSeverePain: false,
          fainting: false,
          possiblePregnancySuspected: false,
        },
      } as TriageLog);
    }

    if (
      !isLastCycle &&
      (opts.painBetweenPeriodsDays || opts.bleedingBetweenPeriodsDays)
    ) {
      const gapMidpoint = Math.floor(opts.cycleLength / 2);
      const days = Math.max(
        opts.painBetweenPeriodsDays ?? 0,
        opts.bleedingBetweenPeriodsDays ?? 0,
      );
      for (let d = 0; d < days; d++) {
        logs.push({
          logDate: addDays(periodStart, opts.periodLength + gapMidpoint + d),
          periodDay: false,
          bleedingLevel:
            d < (opts.bleedingBetweenPeriodsDays ?? 0) ? "spotting" : "none",
          painScore:
            d < (opts.painBetweenPeriodsDays ?? 0)
              ? (opts.nonPeriodPain ?? 3)
              : 0,
          painLocations: [],
          symptoms: { painWithBowelMovements: false, painWithUrination: false },
          impact: {
            missedSchool: false,
            missedWork: false,
            sleepDisrupted: false,
            activitiesLimited: false,
          },
          redFlags: {
            suddenSeverePain: false,
            fainting: false,
            possiblePregnancySuspected: false,
          },
        } as TriageLog);
      }
    }
  }

  logs.sort((a, b) => (a.logDate < b.logDate ? -1 : 1));

  if (opts.finalLogOverride) {
    const last = logs[logs.length - 1]!;
    Object.assign(last, opts.finalLogOverride, {
      symptoms: { ...last.symptoms, ...(opts.finalLogOverride.symptoms ?? {}) },
      impact: { ...last.impact, ...(opts.finalLogOverride.impact ?? {}) },
      redFlags: { ...last.redFlags, ...(opts.finalLogOverride.redFlags ?? {}) },
    });
  }

  return logs;
}

interface Scenario {
  id: string;
  description: string;
  expectedOutcome: "routine" | "assess_soon" | "urgent";
  history: HistoryOptions;
}

const MILD: HistoryOptions = {
  cycles: 3,
  cycleLength: 28,
  periodLength: 4,
  startDate: "2026-01-01",
  basePain: 3,
  bleedingLevel: "light",
};

const scenarios: Scenario[] = [
  // --- urgent: sudden severe pain (14 fixtures total across all urgent types) ---
  {
    id: "urgent-01-sudden-severe-pain-routine-history",
    description:
      "Sudden severe pelvic pain reported today, otherwise mild unremarkable history.",
    expectedOutcome: "urgent",
    history: {
      ...MILD,
      finalLogOverride: {
        redFlags: {
          suddenSeverePain: true,
          fainting: false,
          possiblePregnancySuspected: false,
        },
      },
    },
  },
  {
    id: "urgent-02-sudden-severe-pain-with-concerning-history",
    description:
      "Sudden severe pain on top of a history that would otherwise be assess_soon (repeated disruption) — urgent must still win.",
    expectedOutcome: "urgent",
    history: {
      ...MILD,
      impactDaysPerCycle: 4,
      finalLogOverride: {
        redFlags: {
          suddenSeverePain: true,
          fainting: false,
          possiblePregnancySuspected: false,
        },
      },
    },
  },
  {
    id: "urgent-03-sudden-severe-pain-minimal-history",
    description:
      "Sudden severe pain reported with only a single period ever logged.",
    expectedOutcome: "urgent",
    history: {
      ...MILD,
      cycles: 1,
      finalLogOverride: {
        redFlags: {
          suddenSeverePain: true,
          fainting: false,
          possiblePregnancySuspected: false,
        },
      },
    },
  },
  {
    id: "urgent-04-sudden-severe-pain-long-history",
    description:
      "Sudden severe pain after 6 cycles of otherwise mild tracking.",
    expectedOutcome: "urgent",
    history: {
      ...MILD,
      cycles: 6,
      finalLogOverride: {
        redFlags: {
          suddenSeverePain: true,
          fainting: false,
          possiblePregnancySuspected: false,
        },
      },
    },
  },
  // --- urgent: fainting ---
  {
    id: "urgent-05-fainting-routine-history",
    description:
      "Fainting reported today, otherwise mild unremarkable history.",
    expectedOutcome: "urgent",
    history: {
      ...MILD,
      finalLogOverride: {
        redFlags: {
          suddenSeverePain: false,
          fainting: true,
          possiblePregnancySuspected: false,
        },
      },
    },
  },
  {
    id: "urgent-06-fainting-with-concerning-history",
    description:
      "Fainting on top of a history with worsening cramps — urgent must still win.",
    expectedOutcome: "urgent",
    history: {
      ...MILD,
      painSlopePerCycle: 2,
      finalLogOverride: {
        redFlags: {
          suddenSeverePain: false,
          fainting: true,
          possiblePregnancySuspected: false,
        },
      },
    },
  },
  {
    id: "urgent-07-fainting-minimal-history",
    description: "Fainting reported with only a single period ever logged.",
    expectedOutcome: "urgent",
    history: {
      ...MILD,
      cycles: 1,
      finalLogOverride: {
        redFlags: {
          suddenSeverePain: false,
          fainting: true,
          possiblePregnancySuspected: false,
        },
      },
    },
  },
  {
    id: "urgent-08-fainting-with-heavy-bleeding-history",
    description:
      "Fainting on top of a heavy-bleeding history — urgent must still win over assess_soon.",
    expectedOutcome: "urgent",
    history: {
      ...MILD,
      heavyBleedingLastNDays: 3,
      finalLogOverride: {
        redFlags: {
          suddenSeverePain: false,
          fainting: true,
          possiblePregnancySuspected: false,
        },
      },
    },
  },
  {
    id: "urgent-09-fainting-and-sudden-severe-pain",
    description: "Both fainting and sudden severe pain reported together.",
    expectedOutcome: "urgent",
    history: {
      ...MILD,
      finalLogOverride: {
        redFlags: {
          suddenSeverePain: true,
          fainting: true,
          possiblePregnancySuspected: false,
        },
      },
    },
  },
  // --- urgent: possible pregnancy with severe pain ---
  {
    id: "urgent-10-possible-pregnancy-severe-pain-9",
    description: "Possible pregnancy with a pain score of 9 today.",
    expectedOutcome: "urgent",
    history: {
      ...MILD,
      finalLogOverride: {
        painScore: 9,
        redFlags: {
          suddenSeverePain: false,
          fainting: false,
          possiblePregnancySuspected: true,
        },
      },
    },
  },
  {
    id: "urgent-11-possible-pregnancy-severe-pain-boundary-7",
    description:
      "Possible pregnancy with a pain score of exactly 7 (the rule's >=7 boundary).",
    expectedOutcome: "urgent",
    history: {
      ...MILD,
      finalLogOverride: {
        painScore: 7,
        redFlags: {
          suddenSeverePain: false,
          fainting: false,
          possiblePregnancySuspected: true,
        },
      },
    },
  },
  {
    id: "urgent-12-possible-pregnancy-severe-pain-10",
    description: "Possible pregnancy with the maximum pain score of 10.",
    expectedOutcome: "urgent",
    history: {
      ...MILD,
      finalLogOverride: {
        painScore: 10,
        redFlags: {
          suddenSeverePain: false,
          fainting: false,
          possiblePregnancySuspected: true,
        },
      },
    },
  },
  {
    id: "urgent-13-possible-pregnancy-severe-pain-with-concerning-history",
    description:
      "Possible pregnancy with severe pain today, on top of a history with pain between periods.",
    expectedOutcome: "urgent",
    history: {
      ...MILD,
      painBetweenPeriodsDays: 2,
      finalLogOverride: {
        painScore: 8,
        redFlags: {
          suddenSeverePain: false,
          fainting: false,
          possiblePregnancySuspected: true,
        },
      },
    },
  },
  {
    id: "urgent-14-possible-pregnancy-severe-pain-minimal-history",
    description:
      "Possible pregnancy with severe pain, only a single period ever logged.",
    expectedOutcome: "urgent",
    history: {
      ...MILD,
      cycles: 1,
      finalLogOverride: {
        painScore: 8,
        redFlags: {
          suddenSeverePain: false,
          fainting: false,
          possiblePregnancySuspected: true,
        },
      },
    },
  },

  // --- assess_soon ---
  {
    id: "assess-soon-01-repeated-disruption-boundary-3",
    description:
      "Pain disrupted school/sleep on exactly 3 days in the last 3 cycles (the >=3 boundary).",
    expectedOutcome: "assess_soon",
    history: { ...MILD, impactDaysPerCycle: 1 },
  },
  {
    id: "assess-soon-02-repeated-disruption-frequent",
    description:
      "Pain disrupted school/work/sleep most days across the last 3 cycles.",
    expectedOutcome: "assess_soon",
    history: { ...MILD, impactDaysPerCycle: 3 },
  },
  {
    id: "assess-soon-03-worsening-cramps-mild-slope",
    description: "Cramps clearly worsening cycle over cycle.",
    expectedOutcome: "assess_soon",
    history: { ...MILD, painSlopePerCycle: 3 },
  },
  {
    id: "assess-soon-04-worsening-cramps-steep-slope",
    description: "Cramps worsening sharply cycle over cycle.",
    expectedOutcome: "assess_soon",
    history: { ...MILD, basePain: 1, painSlopePerCycle: 3 },
  },
  {
    id: "assess-soon-05-pain-between-periods-single-day",
    description: "A single day of pelvic pain outside menstruation.",
    expectedOutcome: "assess_soon",
    history: { ...MILD, painBetweenPeriodsDays: 1 },
  },
  {
    id: "assess-soon-06-pain-between-periods-several-days",
    description:
      "Several days of pelvic pain outside menstruation, each cycle.",
    expectedOutcome: "assess_soon",
    history: { ...MILD, painBetweenPeriodsDays: 3 },
  },
  {
    id: "assess-soon-07-pain-with-bowel-movements",
    description: "Pain with bowel movements during the most recent period.",
    expectedOutcome: "assess_soon",
    history: { ...MILD, bowelOrUrinationOnLastPeriod: "bowel" },
  },
  {
    id: "assess-soon-08-pain-with-urination",
    description: "Pain with urination during the most recent period.",
    expectedOutcome: "assess_soon",
    history: { ...MILD, bowelOrUrinationOnLastPeriod: "urination" },
  },
  {
    id: "assess-soon-09-pain-with-bowel-and-urination",
    description:
      "Pain with both bowel movements and urination during the most recent period.",
    expectedOutcome: "assess_soon",
    history: { ...MILD, bowelOrUrinationOnLastPeriod: "both" },
  },
  {
    id: "assess-soon-10-heavy-bleeding-boundary-2-days",
    description:
      "Exactly 2 heavy-bleeding days in the most recent period (the >=2 boundary).",
    expectedOutcome: "assess_soon",
    history: { ...MILD, periodLength: 5, heavyBleedingLastNDays: 2 },
  },
  {
    id: "assess-soon-11-prolonged-period-8-days",
    description: "The most recent period lasted 8 days (>7).",
    expectedOutcome: "assess_soon",
    history: { ...MILD, periodLength: 8 },
  },
  {
    id: "assess-soon-12-prolonged-period-10-days",
    description: "The most recent period lasted 10 days (>7).",
    expectedOutcome: "assess_soon",
    history: { ...MILD, periodLength: 10 },
  },
  {
    id: "assess-soon-13-repeated-bleeding-between-periods",
    description: "Repeated spotting between periods across recent cycles.",
    expectedOutcome: "assess_soon",
    history: { ...MILD, bleedingBetweenPeriodsDays: 2 },
  },
  {
    id: "assess-soon-14-combined-worsening-and-between-period-pain",
    description:
      "Worsening cramps combined with pain between periods — still assess_soon, not urgent.",
    expectedOutcome: "assess_soon",
    history: { ...MILD, painSlopePerCycle: 2, painBetweenPeriodsDays: 2 },
  },

  // --- routine ---
  {
    id: "routine-01-mild-no-impact",
    description: "Mild, regular cramps with no disruption to daily life.",
    expectedOutcome: "routine",
    history: { ...MILD },
  },
  {
    id: "routine-02-single-cycle-mild",
    description: "Only one mild period ever logged.",
    expectedOutcome: "routine",
    history: { ...MILD, cycles: 1 },
  },
  {
    id: "routine-03-long-history-consistently-mild",
    description: "Six cycles of consistently mild, unremarkable periods.",
    expectedOutcome: "routine",
    history: { ...MILD, cycles: 6 },
  },
  {
    id: "routine-04-no-logs-at-all",
    description:
      "No logs at all yet — the system must default to routine, not crash.",
    expectedOutcome: "routine",
    history: { ...MILD, cycles: 0 },
  },
  {
    id: "routine-05-short-regular-cycle",
    description: "A short (24-day) but regular, mild cycle.",
    expectedOutcome: "routine",
    history: { ...MILD, cycleLength: 24 },
  },
  {
    id: "routine-06-long-regular-cycle",
    description: "A long (34-day) but regular, mild cycle.",
    expectedOutcome: "routine",
    history: { ...MILD, cycleLength: 34 },
  },
  {
    id: "routine-07-boundary-missed-days-2",
    description:
      "Only 2 missed-activity days total (one per cycle, 2 cycles) — just under the assess_soon threshold of 3.",
    expectedOutcome: "routine",
    history: { ...MILD, cycles: 2, impactDaysPerCycle: 1 },
  },
  {
    id: "routine-08-boundary-heavy-bleeding-1-day",
    description:
      "Only 1 heavy-bleeding day — just under the assess_soon threshold of 2.",
    expectedOutcome: "routine",
    history: { ...MILD, periodLength: 5, heavyBleedingLastNDays: 1 },
  },
  {
    id: "routine-09-boundary-period-exactly-7-days",
    description: "The most recent period lasted exactly 7 days (not >7).",
    expectedOutcome: "routine",
    history: { ...MILD, periodLength: 7 },
  },
  {
    id: "routine-10-flat-pain-trend",
    description:
      "Pain score is flat across recent cycles (no worsening trend).",
    expectedOutcome: "routine",
    history: { ...MILD, basePain: 4, painSlopePerCycle: 0 },
  },
  {
    id: "routine-11-improving-pain-trend",
    description:
      "Pain score is improving (negative slope) across recent cycles.",
    expectedOutcome: "routine",
    history: { ...MILD, basePain: 6, painSlopePerCycle: -1.5 },
  },
  {
    id: "routine-12-no-pain-between-periods",
    description: "No pain or bleeding outside menstruation at all.",
    expectedOutcome: "routine",
    history: {
      ...MILD,
      painBetweenPeriodsDays: 0,
      bleedingBetweenPeriodsDays: 0,
    },
  },
  {
    id: "routine-13-zero-pain-score",
    description: "Periods tracked with no pain reported at all.",
    expectedOutcome: "routine",
    history: { ...MILD, basePain: 0 },
  },
  {
    id: "routine-14-moderate-pain-no-disruption",
    description:
      "Moderate pain (5/10) but never disrupting school/work/sleep/activities.",
    expectedOutcome: "routine",
    history: { ...MILD, basePain: 5 },
  },
];

const fixturesDir = path.join(import.meta.dirname, "..", "src", "fixtures");
mkdirSync(fixturesDir, { recursive: true });

for (const scenario of scenarios) {
  const logs =
    scenario.history.cycles === 0 ? [] : buildHistory(scenario.history);
  const fixture = {
    id: scenario.id,
    description: scenario.description,
    expectedOutcome: scenario.expectedOutcome,
    logs,
  };
  writeFileSync(
    path.join(fixturesDir, `${scenario.id}.json`),
    `${JSON.stringify(fixture, null, 2)}\n`,
  );
}

console.log(`Wrote ${scenarios.length} fixtures to ${fixturesDir}`);
console.log(
  `  urgent: ${scenarios.filter((s) => s.expectedOutcome === "urgent").length}, ` +
    `assess_soon: ${scenarios.filter((s) => s.expectedOutcome === "assess_soon").length}, ` +
    `routine: ${scenarios.filter((s) => s.expectedOutcome === "routine").length}`,
);

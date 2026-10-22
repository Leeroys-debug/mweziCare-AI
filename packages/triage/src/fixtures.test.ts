import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { draftRuleset, evaluate } from "@mwezicare/rules-engine";
import { describe, expect, it } from "vitest";
import { deriveCycles } from "./cycles";
import {
  extractFeatures,
  extractRedFlagFeatures,
  type TriageLog,
} from "./features";

interface Fixture {
  id: string;
  description: string;
  expectedOutcome: "routine" | "assess_soon" | "urgent";
  logs: TriageLog[];
}

const fixturesDir = path.join(import.meta.dirname, "fixtures");
const fixtures: Fixture[] = readdirSync(fixturesDir)
  .filter((f) => f.endsWith(".json"))
  .map(
    (f) =>
      JSON.parse(readFileSync(path.join(fixturesDir, f), "utf8")) as Fixture,
  );

/**
 * Mirrors what POST /api/v1/assessments does: history features plus the
 * most recent log's red-flag/pain-score features, merged into one flat
 * record and evaluated once — see apps/web/app/api/v1/assessments/route.ts.
 */
function evaluateFixture(fixture: Fixture) {
  const cycles = deriveCycles(fixture.logs);
  const historyFeatures = extractFeatures(fixture.logs, cycles);
  const latestLog = [...fixture.logs]
    .sort((a, b) => (a.logDate < b.logDate ? -1 : 1))
    .at(-1);
  const redFlagFeatures = extractRedFlagFeatures(latestLog ?? {});
  return evaluate(draftRuleset, { ...historyFeatures, ...redFlagFeatures });
}

describe("triage fixtures", () => {
  it(`loads at least 40 fixtures, at least 10 of them urgent`, () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(40);
    expect(
      fixtures.filter((f) => f.expectedOutcome === "urgent").length,
    ).toBeGreaterThanOrEqual(10);
  });

  it.each(fixtures.map((f) => [f.id, f] as const))(
    "%s resolves to its expected outcome",
    (_id, fixture) => {
      const result = evaluateFixture(fixture);
      expect(result.outcome).toBe(fixture.expectedOutcome);
    },
  );

  // Explicit, ticket-mandated gate: this single assertion fails the whole
  // `pnpm test` run (and therefore the build) if even one urgent fixture
  // doesn't come back urgent — the highest-stakes case gets its own check,
  // not just coverage via the parameterized loop above.
  it("every urgent fixture resolves to urgent", () => {
    const urgentFixtures = fixtures.filter(
      (f) => f.expectedOutcome === "urgent",
    );
    const failures = urgentFixtures
      .map((f) => ({ id: f.id, outcome: evaluateFixture(f).outcome }))
      .filter((r) => r.outcome !== "urgent");
    expect(failures).toEqual([]);
  });
});

// Node-only (readdirSync/readFileSync) — deliberately NOT re-exported from
// ./index.ts. A "use client" component importing anything from the bare
// @mwezicare/triage package name pulls in the whole barrel's transitive
// graph; bundling this file into a browser chunk broke `next build`
// (Turbopack: "chunking context does not support external modules", /
// webpack: "UnhandledSchemeError" on node:fs). Server-only callers
// (apps/web/app/api/v1/rulesets/run-fixtures/route.ts) import this via the
// package's "./fixtures-runner" subpath export instead.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  evaluate,
  type Ruleset,
  type EvaluationResult,
} from "@mwezicare/rules-engine";
import { deriveCycles } from "./cycles";
import {
  extractFeatures,
  extractRedFlagFeatures,
  type TriageLog,
} from "./features";

export interface TriageFixture {
  id: string;
  description: string;
  expectedOutcome: "routine" | "assess_soon" | "urgent";
  logs: TriageLog[];
}

/** The same 40+ synthetic fixtures src/fixtures.test.ts checks the shipped draft ruleset against. */
export function loadTriageFixtures(): TriageFixture[] {
  const fixturesDir = path.join(import.meta.dirname, "fixtures");
  return readdirSync(fixturesDir)
    .filter((f) => f.endsWith(".json"))
    .map(
      (f) =>
        JSON.parse(
          readFileSync(path.join(fixturesDir, f), "utf8"),
        ) as TriageFixture,
    );
}

/**
 * Evaluates one fixture's logs against an arbitrary ruleset — used by the
 * staff rulesets console's "Run fixtures" button so a clinician can check a
 * draft/edited ruleset against the same fixtures before approving it, not
 * just the one ruleset packages/triage's own tests hardcode.
 */
export function evaluateFixtureAgainstRuleset(
  fixture: TriageFixture,
  ruleset: Ruleset,
): EvaluationResult {
  const cycles = deriveCycles(fixture.logs);
  const historyFeatures = extractFeatures(fixture.logs, cycles);
  const latestLog = [...fixture.logs]
    .sort((a, b) => (a.logDate < b.logDate ? -1 : 1))
    .at(-1);
  const redFlagFeatures = extractRedFlagFeatures(latestLog ?? {});
  return evaluate(ruleset, { ...historyFeatures, ...redFlagFeatures });
}

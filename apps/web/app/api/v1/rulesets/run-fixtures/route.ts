import { NextResponse } from "next/server";
import { ruleSchema } from "@mwezicare/rules-engine";
import {
  evaluateFixtureAgainstRuleset,
  loadTriageFixtures,
} from "@mwezicare/triage/fixtures-runner";
import { z } from "zod";
import { assertSameOrigin } from "@/lib/csrf";
import { problem } from "@/lib/problem-details";
import { requireApiRole } from "@/lib/rbac";

const STAFF_READ_ROLES = [
  "clinician",
  "programme_admin",
  "system_admin",
] as const;

const runFixturesSchema = z.object({
  version: z.number().int().positive(),
  rules: z.array(ruleSchema).min(1),
});

/**
 * Evaluates every packages/triage synthetic fixture against the candidate
 * rules currently in the editor (not necessarily saved yet) — lets a
 * clinician check a draft edit before saving or approving it.
 */
export async function POST(request: Request) {
  const csrfError = assertSameOrigin(request);
  if (csrfError) return csrfError;

  const roleCheck = await requireApiRole([...STAFF_READ_ROLES]);
  if (!roleCheck.ok) return roleCheck.response;

  const body = await request.json().catch(() => null);
  const parsed = runFixturesSchema.safeParse(body);
  if (!parsed.success)
    return problem(400, "Invalid ruleset", parsed.error.message);

  const ruleset = {
    version: parsed.data.version,
    status: "draft" as const,
    rules: parsed.data.rules,
  };
  const fixtures = loadTriageFixtures();

  const results = fixtures.map((fixture) => {
    const { outcome } = evaluateFixtureAgainstRuleset(fixture, ruleset);
    return {
      id: fixture.id,
      description: fixture.description,
      expectedOutcome: fixture.expectedOutcome,
      actualOutcome: outcome,
      pass: outcome === fixture.expectedOutcome,
    };
  });

  const failCount = results.filter((r) => !r.pass).length;
  return NextResponse.json({ results, total: results.length, failCount });
}

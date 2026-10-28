import { generateObject } from "ai";
import { z } from "zod";

export interface PostFilterResult {
  safe: boolean;
  reason?: string | null;
}

const DIAGNOSTIC_PATTERNS = [
  // "you have X" / "you've got X" as a direct, unhedged claim. Excludes the
  // immediate lead-ins that turn this into advisory or negated text instead
  // of a diagnostic assertion — "if/whether(-or-not) you have X" (conditional,
  // e.g. "If you have endometriosis and are trying to conceive..."), "...
  // mean/that you have X" (negated, e.g. "doesn't mean you have it", "never
  // tells you that you have endometriosis") — plus the "have to" idiom
  // ("something you have to live with" isn't a medical claim at all). Content
  // written for this app leans on exactly these hedges (CLAUDE.md: never
  // state or imply a diagnosis), so the original unqualified pattern flagged
  // much of it as a false positive — see postfilter.test.ts for the fixture
  // pairs this was tuned against. Also fixes a real miss: "you've got" never
  // matched at all before, since "you" and "'ve" have no space between them
  // in a genuine contraction.
  /(?<!\bif\s)(?<!\bwhether\s)(?<!\bwhether or not\s)(?<!\bmean\s)(?<!\bthat\s)\byou(?:\s+have(?!\s+to\b)|'ve\s+got)\b/i,
  /\byou('re| are) (definitely|certainly)\b/i,
  /\bdefinitely (normal|not normal|a sign of|have)\b/i,
  /\bthis (means|confirms) you (have|are)\b/i,
  /\bu(na)?(ye)?.{0,10}(ugonjwa|hali) ya\b/i, // crude Swahili "you have [condition]"
];

const DOSING_PATTERNS = [
  /\b\d+\s?(mg|milligrams?|ml|millilitres?|milliliters?)\b/i,
  /\btake\s+\d+\s*(tablets?|pills?|capsules?)?\b/i,
  /\b\d+\s*(tablets?|pills?|capsules?)\b/i,
];

/** Fast, deterministic first pass — no model call. */
export function regexScan(text: string): PostFilterResult {
  if (DIAGNOSTIC_PATTERNS.some((pattern) => pattern.test(text))) {
    return { safe: false, reason: "diagnostic_language" };
  }
  if (DOSING_PATTERNS.some((pattern) => pattern.test(text))) {
    return { safe: false, reason: "dosing" };
  }
  return { safe: true };
}

/**
 * Injectable so tests don't need a real model call — see
 * src/pipeline.test.ts.
 */
export interface SafetyChecker {
  check(text: string): Promise<PostFilterResult>;
}

// `reason` is nullable, not optional: OpenAI's structured-output strict
// mode requires every property to appear in the schema's `required` array,
// which Vercel AI SDK can't do for a plain `.optional()` Zod field —
// generateObject then fails with "'required' is ... missing 'reason'."
// Nullable keeps the field present (as `null`) while still being "no reason
// given," which pipeline.ts's `?? "unsafe"` already handles the same way.
const safetySchema = z.object({
  safe: z.boolean(),
  reason: z.string().nullable(),
});

export class GatewaySafetyChecker implements SafetyChecker {
  constructor(private readonly model: string) {}

  async check(text: string): Promise<PostFilterResult> {
    const { object } = await generateObject({
      model: this.model,
      schema: safetySchema,
      system:
        "You are a safety reviewer for a menstrual-health education assistant's draft reply to a " +
        "15-24 year old. Mark safe:false if the reply states or implies the user has a specific " +
        "medical condition, gives a medication name/dose/timing, or declares a symptom definitely " +
        "normal or definitely a problem. Otherwise mark safe:true.",
      prompt: text,
    });
    return object;
  }
}

/**
 * Regex check first (cheap, deterministic), then the model-based check only
 * if the regex pass is clean — on any failure, the caller (pipeline.ts)
 * replaces `text` with the safe fallback instead of showing it.
 */
export async function postFilter(
  text: string,
  checker: SafetyChecker,
): Promise<PostFilterResult> {
  const regexResult = regexScan(text);
  if (!regexResult.safe) return regexResult;
  return checker.check(text);
}

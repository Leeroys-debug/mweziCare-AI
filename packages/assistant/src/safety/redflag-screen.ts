import {
  evaluate,
  urgentOnlyRuleset,
  type EvaluationResult,
} from "@mwezicare/rules-engine";

// Deliberately simple keyword matching, not NLU — a false positive here
// just means a routine question gets the (harmless) fixed safety response
// instead of a generated one; a false negative is the dangerous direction,
// so patterns favor recall. English + Swahili.
const SEVERE_PAIN_PATTERNS = [
  /sudden(ly)?.{0,20}(severe|intense|sharp)/i,
  /(severe|intense|excruciating|unbearable|worst).{0,15}pain/i,
  /pain.{0,15}(severe|intense|excruciating|unbearable|unlike anything)/i,
  /maumivu.{0,10}(makali|ya ghafla|yasiyovumilika)/i,
  /(ghafla|haraka).{0,15}maumivu/i,
];

const FAINTING_PATTERNS = [
  /\bfaint(ed|ing)?\b/i,
  /passed? out/i,
  /black(ed)? out/i,
  /about to (faint|collapse)/i,
  /\bdizzy\b.{0,15}(collapse|faint)/i,
  /ni(me|na)zimia/i,
  /kuzimia/i,
];

const PREGNANCY_PATTERNS = [
  /\b(i('m| am)|i think i('m| am)|might be|could be) pregnant\b/i,
  /possible(ly)? pregnan/i,
  /\bmjamzito\b/i,
  /\bujauzito\b/i,
];

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

/**
 * Extracts the same structured red-flag features @mwezicare/triage derives
 * from a symptom log (suddenSeverePain/fainting/possiblePregnancySuspected/
 * painScore) from free-text chat, via keyword matching, then runs them
 * through @mwezicare/rules-engine's actual urgent-only ruleset — reusing the
 * deterministic triage urgent screen rather than inventing a parallel one
 * (spec: "run the rules-engine urgent screen on keywords/structured
 * extraction").
 */
export function screenForUrgentRedFlags(text: string): EvaluationResult {
  const severePain = matchesAny(text, SEVERE_PAIN_PATTERNS);
  const fainting = matchesAny(text, FAINTING_PATTERNS);
  const possiblePregnancySuspected = matchesAny(text, PREGNANCY_PATTERNS);

  return evaluate(urgentOnlyRuleset, {
    suddenSeverePain: severePain,
    fainting,
    possiblePregnancySuspected,
    // The urgent_possible_pregnancy_with_severe_pain rule needs painScore
    // >= 7; free text has no 0-10 score, so a detected severe-pain phrase
    // stands in for it.
    painScore: severePain ? 8 : 0,
  });
}

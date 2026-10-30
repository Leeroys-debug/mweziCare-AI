/**
 * Strips [CLINICAL REVIEW REQUIRED] / [TRANSLATION REVIEW REQUIRED]
 * placeholder tags once a clinician has actually approved the text they're
 * embedded in (KB article bodies, rule reason text) — CLAUDE.md's "No
 * clinical content as final" is why the tags exist, but they're inline in
 * otherwise user-facing prose, so once a named clinician has signed off,
 * a real user should see the approved sentence, not the internal marker.
 * Shared by apps/web's kb-documents approve route and packages/db's
 * approveRuleset.
 */
const REVIEW_TAG_PATTERN =
  /\[(?:CLINICAL REVIEW REQUIRED|TRANSLATION REVIEW REQUIRED)\]\s*/g;

export function stripReviewTags(text: string): string {
  return text.replace(REVIEW_TAG_PATTERN, "").trim();
}

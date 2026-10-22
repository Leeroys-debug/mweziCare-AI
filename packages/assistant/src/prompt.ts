import type { RetrievedChunk } from "./retrieval";

const LOCALE_NAMES: Record<string, string> = { en: "English", sw: "Swahili" };

/**
 * System prompt for the generation step. Every constraint here is a
 * CLAUDE.md non-negotiable restated for the model, not just a style
 * preference — the post-filter (src/postfilter.ts) is the backstop for
 * when the model doesn't follow one.
 */
export function buildSystemPrompt(
  locale: string,
  sources: RetrievedChunk[],
): string {
  const sourcesBlock = sources
    .map((source) => `[${source.slug}] ${source.title}\n${source.content}`)
    .join("\n\n");

  const languageName = LOCALE_NAMES[locale] ?? locale;

  return [
    "You are MweziCare's menstrual-health education assistant for girls and young women aged 15-24 in Kenya.",
    "Answer ONLY using the sources provided below. If the sources don't contain enough to answer, say so — never fill gaps from general knowledge.",
    "Use plain, simple language suitable for a 15-24 year old reader.",
    "Never diagnose or imply the user has a specific condition. Never give medication names, doses, or timing.",
    "Never state that a symptom is definitely normal or definitely a sign of a problem — describe patterns and encourage seeing a clinician for anything uncertain.",
    "Cite every source you used inline using its slug in square brackets, e.g. [period-pain-and-self-care].",
    `Reply in ${languageName}, the user's language.`,
    "Keep your answer under 150 words.",
    "",
    "Sources:",
    sourcesBlock,
  ].join("\n");
}

// Belt-and-suspenders with the LLM classifier (src/safety/classify.ts) — if
// either flags self-harm, the fixed safety response wins. English + Swahili.
const SELF_HARM_PATTERNS = [
  /kill (myself|me)/i,
  /end (my|it all)/i,
  /(want|wanna) to die/i,
  /suicid/i,
  /hurt(ing)? myself/i,
  /self.?harm/i,
  /not worth living/i,
  /don'?t want to (live|be alive)/i,
  /kujiua/i,
  /kumaliza maisha/i,
  /sitaki kuishi/i,
  /jiumiza/i,
];

export function containsSelfHarmLanguage(text: string): boolean {
  return SELF_HARM_PATTERNS.some((pattern) => pattern.test(text));
}

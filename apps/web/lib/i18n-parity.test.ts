import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import sw from "../messages/sw.json";
import { flattenMessages } from "./flatten-messages";

/**
 * Fails loudly (lists every offending key) the moment en.json and sw.json
 * drift apart — the acceptance criterion is "a test that fails if any key
 * exists in en but not sw" (E2 spec), but checking both directions catches
 * stray/typo'd keys in sw.json too.
 */
describe("i18n key parity (en.json <-> sw.json)", () => {
  const enFlat = flattenMessages(en);
  const swFlat = flattenMessages(sw);
  const enKeys = new Set(Object.keys(enFlat));
  const swKeys = new Set(Object.keys(swFlat));

  it("has no key present in en.json but missing from sw.json", () => {
    const missing = [...enKeys].filter((key) => !swKeys.has(key)).sort();
    expect(missing, `Missing from sw.json:\n${missing.join("\n")}`).toEqual([]);
  });

  it("has no key present in sw.json but missing from en.json", () => {
    const extra = [...swKeys].filter((key) => !enKeys.has(key)).sort();
    expect(
      extra,
      `Present in sw.json but not en.json:\n${extra.join("\n")}`,
    ).toEqual([]);
  });

  it("has no empty translation in sw.json for a non-empty en.json string", () => {
    const empty = [...enKeys]
      .filter(
        (key) =>
          enFlat[key]!.trim().length > 0 &&
          (swFlat[key] ?? "").trim().length === 0,
      )
      .sort();
    expect(
      empty,
      `Empty sw.json translation for:\n${empty.join("\n")}`,
    ).toEqual([]);
  });
});

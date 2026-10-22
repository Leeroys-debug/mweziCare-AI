import { describe, expect, it } from "vitest";
import { loadSummaryPdfLabels } from "./i18n-labels";

describe("loadSummaryPdfLabels", () => {
  it.each(["en", "sw"])(
    "resolves every PDF label for locale %s",
    async (locale) => {
      const labels = await loadSummaryPdfLabels(locale);
      for (const [key, value] of Object.entries(labels)) {
        if (typeof value === "string") {
          expect(
            value.length,
            `labels.${key} should not be empty`,
          ).toBeGreaterThan(0);
        } else {
          for (const [nestedKey, nestedValue] of Object.entries(value)) {
            expect(
              (nestedValue as string).length,
              `labels.${key}.${nestedKey} should not be empty`,
            ).toBeGreaterThan(0);
          }
        }
      }
    },
  );
});

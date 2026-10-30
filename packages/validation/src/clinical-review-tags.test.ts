import { describe, expect, it } from "vitest";
import { stripReviewTags } from "./clinical-review-tags";

describe("stripReviewTags", () => {
  it("strips a single [CLINICAL REVIEW REQUIRED] prefix", () => {
    expect(
      stripReviewTags("[CLINICAL REVIEW REQUIRED] Endometriosis is..."),
    ).toBe("Endometriosis is...");
  });

  it("strips a paired [CLINICAL REVIEW REQUIRED][TRANSLATION REVIEW REQUIRED] prefix", () => {
    expect(
      stripReviewTags(
        "[CLINICAL REVIEW REQUIRED][TRANSLATION REVIEW REQUIRED] Umeripoti maumivu.",
      ),
    ).toBe("Umeripoti maumivu.");
  });

  it("strips every occurrence across multiple paragraphs", () => {
    const body =
      "[CLINICAL REVIEW REQUIRED] First paragraph.\n\n" +
      "[CLINICAL REVIEW REQUIRED] Second paragraph.";
    expect(stripReviewTags(body)).toBe("First paragraph.\n\nSecond paragraph.");
  });

  it("leaves text with no tags unchanged", () => {
    expect(stripReviewTags("Already clean text.")).toBe("Already clean text.");
  });

  it("trims any leading/trailing whitespace left after stripping", () => {
    expect(stripReviewTags("[CLINICAL REVIEW REQUIRED]   Leading space.")).toBe(
      "Leading space.",
    );
  });
});

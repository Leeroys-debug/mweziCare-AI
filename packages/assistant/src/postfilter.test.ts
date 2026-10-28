import { describe, expect, it } from "vitest";
import { regexScan } from "./postfilter";

describe("regexScan", () => {
  describe("catches true diagnostic assertions", () => {
    const cases = [
      "You have endometriosis.",
      "Based on this, you have PCOS.",
      "This confirms you have an infection.",
      "you have a serious condition",
      "You've got endometriosis, based on your symptoms.",
      "It sounds like you have endometriosis.",
      "In summary, you have PCOS.",
      "You're definitely experiencing a hormonal imbalance.",
      "This is definitely a sign of endometriosis.",
      "This means you have a thyroid problem.",
    ];
    for (const text of cases) {
      it(`flags: "${text}"`, () => {
        expect(regexScan(text).safe).toBe(false);
      });
    }
  });

  describe("does not flag hedged or advisory phrasing using the same words", () => {
    const cases = [
      "If you have endometriosis and are trying to conceive, see a clinician.",
      "This doesn't mean you have it.",
      "This app never tells you that you have endometriosis.",
      "If you have questions about your own anatomy, ask a clinician.",
      "Something you have to live with.",
      "Whether you have endometriosis is something only a clinician can determine.",
      "If you have consistently heavy periods, ask a clinician.",
      "This doesn't automatically mean you have it.",
      "It isn't a sign that you have endometriosis.",
      "If you have severe pain, seek care.",
      "Whether or not you have endometriosis, tracking helps.",
    ];
    for (const text of cases) {
      it(`allows: "${text}"`, () => {
        expect(regexScan(text).safe).toBe(true);
      });
    }
  });

  it("still catches dosing language", () => {
    expect(regexScan("Take 400 mg of ibuprofen.").safe).toBe(false);
  });

  it("allows plain, non-diagnostic text", () => {
    expect(
      regexScan("Tracking your symptoms can help a clinician assess you.").safe,
    ).toBe(true);
  });
});

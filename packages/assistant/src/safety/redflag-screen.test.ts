import { describe, expect, it } from "vitest";
import { screenForUrgentRedFlags } from "./redflag-screen";

describe("screenForUrgentRedFlags", () => {
  it("flags sudden severe pain as urgent", () => {
    const result = screenForUrgentRedFlags(
      "I have sudden, severe pain in my lower belly",
    );
    expect(result.outcome).toBe("urgent");
  });

  it("flags fainting as urgent", () => {
    const result = screenForUrgentRedFlags(
      "I fainted earlier today during my period",
    );
    expect(result.outcome).toBe("urgent");
  });

  it("flags possible pregnancy with severe pain as urgent", () => {
    const result = screenForUrgentRedFlags(
      "I think I might be pregnant and the pain is unbearable",
    );
    expect(result.outcome).toBe("urgent");
  });

  it("does not flag possible pregnancy alone (no severe pain) as urgent", () => {
    const result = screenForUrgentRedFlags(
      "I think I might be pregnant, what should I do?",
    );
    expect(result.outcome).toBe("routine");
  });

  it("flags Swahili fainting language as urgent", () => {
    const result = screenForUrgentRedFlags("Nimezimia mara kadhaa leo");
    expect(result.outcome).toBe("urgent");
  });

  it("does not flag an ordinary question as urgent", () => {
    const result = screenForUrgentRedFlags(
      "What foods help with period cramps?",
    );
    expect(result.outcome).toBe("routine");
  });
});

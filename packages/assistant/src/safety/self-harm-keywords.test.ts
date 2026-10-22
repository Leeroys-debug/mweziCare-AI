import { describe, expect, it } from "vitest";
import { containsSelfHarmLanguage } from "./self-harm-keywords";

describe("containsSelfHarmLanguage", () => {
  it("flags explicit self-harm language", () => {
    expect(containsSelfHarmLanguage("I want to kill myself")).toBe(true);
    expect(containsSelfHarmLanguage("I don't want to live anymore")).toBe(true);
  });

  it("flags Swahili self-harm language", () => {
    expect(containsSelfHarmLanguage("Nataka kujiua")).toBe(true);
  });

  it("does not flag ordinary messages", () => {
    expect(
      containsSelfHarmLanguage(
        "My period pain is killing my productivity at school",
      ),
    ).toBe(false);
  });
});

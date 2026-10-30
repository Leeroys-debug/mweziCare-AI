import { describe, expect, it } from "vitest";
import { generateUuid } from "./uuid";

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("generateUuid", () => {
  it("produces a well-formed v4 UUID", () => {
    expect(generateUuid()).toMatch(UUID_V4_PATTERN);
  });

  it("produces different values on repeated calls", () => {
    const values = new Set(Array.from({ length: 20 }, () => generateUuid()));
    expect(values.size).toBe(20);
  });

  it("falls back to crypto.getRandomValues when crypto.randomUUID is unavailable (plain HTTP)", () => {
    const original = crypto.randomUUID;
    // @ts-expect-error -- simulating a non-secure-context browser, where
    // crypto.randomUUID is undefined rather than just missing.
    crypto.randomUUID = undefined;
    try {
      expect(generateUuid()).toMatch(UUID_V4_PATTERN);
    } finally {
      crypto.randomUUID = original;
    }
  });
});

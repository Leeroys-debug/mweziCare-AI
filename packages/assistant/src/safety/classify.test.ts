import { describe, expect, it, vi } from "vitest";
import { NoObjectGeneratedError } from "ai";
import { GatewayClassifier } from "./classify";

const { generateObjectMock } = vi.hoisted(() => ({
  generateObjectMock: vi.fn(),
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return { ...actual, generateObject: generateObjectMock };
});

const fakeResponse = { id: "x", timestamp: new Date(), modelId: "test-model" };
const fakeUsage = {
  inputTokens: undefined,
  inputTokenDetails: {
    noCacheTokens: undefined,
    cacheReadTokens: undefined,
    cacheWriteTokens: undefined,
  },
  outputTokens: undefined,
  outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
  totalTokens: undefined,
};

describe("GatewayClassifier", () => {
  it("returns the category from a well-formed object", async () => {
    generateObjectMock.mockResolvedValueOnce({
      object: { category: "in_scope" },
    });
    const classifier = new GatewayClassifier("test-model");
    await expect(classifier.classify("hello", "en")).resolves.toBe("in_scope");
  });

  it("recovers a valid category from a differently-keyed object some models return", async () => {
    // Observed in the wild from a free reasoning model: {"classification":"in_scope"}
    // instead of the requested {"category":"in_scope"} — generateObject can't
    // validate it against the schema and throws NoObjectGeneratedError.
    generateObjectMock.mockRejectedValueOnce(
      new NoObjectGeneratedError({
        message: "schema mismatch",
        text: '{ "classification": "in_scope" }',
        response: fakeResponse,
        usage: fakeUsage,
        finishReason: "stop",
      }),
    );
    const classifier = new GatewayClassifier("test-model");
    await expect(classifier.classify("What foods help?", "en")).resolves.toBe(
      "in_scope",
    );
  });

  it("re-throws when the recovered text has no usable category value", async () => {
    generateObjectMock.mockRejectedValueOnce(
      new NoObjectGeneratedError({
        message: "schema mismatch",
        text: '{ "classification": "not-a-real-category" }',
        response: fakeResponse,
        usage: fakeUsage,
        finishReason: "stop",
      }),
    );
    const classifier = new GatewayClassifier("test-model");
    await expect(classifier.classify("hi", "en")).rejects.toThrow();
  });

  it("re-throws errors that aren't a NoObjectGeneratedError", async () => {
    generateObjectMock.mockRejectedValueOnce(new Error("network error"));
    const classifier = new GatewayClassifier("test-model");
    await expect(classifier.classify("hi", "en")).rejects.toThrow(
      "network error",
    );
  });
});

import { describe, expect, it } from "vitest";
import type { Database, KeyProvider } from "@mwezicare/db";
import { EnvKeyProvider } from "@mwezicare/db";
import { runAssistantPipeline, type PipelineDependencies } from "./pipeline";
import type { Classification, Classifier } from "./safety/classify";
import type { SafetyChecker } from "./postfilter";
import type { EmbeddingProvider } from "./kb/embeddings";
import type { RetrievedChunk } from "./retrieval";
import { redTeamFixtures, type RedTeamCategory } from "./__fixtures__/red-team";

/**
 * Always answers "in_scope" — except for off_topic fixtures, where only the
 * classifier can tell (there's no keyword backstop for off-topic). This is
 * the crux of the red-team set: it proves the deterministic keyword/
 * rules-engine pre-filter (screenForUrgentRedFlags, containsSelfHarmLanguage)
 * catches every urgent/self_harm fixture on its own, with a classifier that
 * would otherwise let them straight through.
 */
class FakeClassifier implements Classifier {
  constructor(private readonly offTopicMessages: Set<string>) {}
  async classify(text: string): Promise<Classification> {
    return this.offTopicMessages.has(text) ? "out_of_scope" : "in_scope";
  }
}

class FakeEmbeddings implements EmbeddingProvider {
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map(() => [0.1, 0.2, 0.3]);
  }
}

const fakeSource: RetrievedChunk = {
  slug: "test-source",
  title: "Test source",
  content: "Some clinician-reviewed content.",
  similarity: 0.9,
  status: "approved",
};

const alwaysSafeChecker: SafetyChecker = {
  check: async () => ({ safe: true }),
};

const keyProvider: KeyProvider = new EnvKeyProvider(
  Buffer.alloc(32, 7).toString("base64"),
);

function baseDeps(
  overrides: Partial<PipelineDependencies> = {},
): PipelineDependencies {
  return {
    db: {} as Database, // never touched — retrieveFn/persistFn are faked below
    classifier: new FakeClassifier(new Set()),
    embeddings: new FakeEmbeddings(),
    safetyChecker: alwaysSafeChecker,
    keyProvider,
    chatModel: "fake/model",
    retrieveFn: async () => [fakeSource],
    persistFn: async (input) => ({
      sessionId: input.sessionId ?? "fake-session",
      messageId: "fake-message",
    }),
    ...overrides,
  };
}

/** Generation behavior varies by red-team category — see runFixture below. */
function generateFnFor(
  category: RedTeamCategory,
): PipelineDependencies["generateFn"] {
  if (category === "diagnosis_request") {
    return async () => ({
      text: "You have endometriosis based on what you described [test-source].",
    });
  }
  if (category === "dosing_request") {
    return async () => ({
      text: "Take 400mg of ibuprofen every 6 hours [test-source].",
    });
  }
  return async () => ({
    text: "Here is some general, sourced information [test-source].",
  });
}

const offTopicMessages = new Set(
  redTeamFixtures
    .filter((f) => f.category === "off_topic")
    .map((f) => f.message),
);

describe("runAssistantPipeline — red-team set", () => {
  it("covers at least 40 fixtures across en and sw", () => {
    expect(redTeamFixtures.length).toBeGreaterThanOrEqual(40);
    expect(redTeamFixtures.some((f) => f.locale === "en")).toBe(true);
    expect(redTeamFixtures.some((f) => f.locale === "sw")).toBe(true);
  });

  for (const fixture of redTeamFixtures) {
    it(`[${fixture.category}/${fixture.locale}] ${fixture.id}`, async () => {
      const deps = baseDeps({
        classifier: new FakeClassifier(offTopicMessages),
        generateFn: generateFnFor(fixture.category),
      });

      const result = await runAssistantPipeline(deps, {
        userId: "test-user",
        message: fixture.message,
        locale: fixture.locale,
      });

      switch (fixture.category) {
        case "urgent":
          expect(result.safetyFlags.category).toBe("urgent");
          expect(result.safetyFlags.detectedBy).toBe("keyword");
          expect(result.text).toContain("[CLINICAL REVIEW REQUIRED]");
          break;
        case "self_harm":
          expect(result.safetyFlags.category).toBe("self_harm");
          expect(result.safetyFlags.detectedBy).toBe("keyword");
          break;
        case "off_topic":
          expect(result.safetyFlags.category).toBe("out_of_scope");
          break;
        case "diagnosis_request":
          // The fake model answered with diagnostic language; the
          // post-filter must have replaced it, not passed it through.
          expect(result.text).not.toMatch(/you have/i);
          expect(result.safetyFlags.postFilter).toBeTruthy();
          break;
        case "dosing_request":
          expect(result.text).not.toMatch(/\d+\s?mg/i);
          expect(result.safetyFlags.postFilter).toBeTruthy();
          break;
        case "pregnancy_info":
        case "routine":
          expect(result.text).toBe(
            "Here is some general, sourced information [test-source].",
          );
          expect(result.sources.map((s) => s.slug)).toContain("test-source");
          break;
      }
    });
  }

  it("prioritizes the keyword pre-filter over the classifier for urgent language", async () => {
    // Classifier is wired to say "in_scope" for everything in this test —
    // the opposite of what a correct classifier would say for this message.
    const deps = baseDeps({ classifier: new FakeClassifier(new Set()) });
    const result = await runAssistantPipeline(deps, {
      userId: "test-user",
      message: "sudden severe pain right now",
      locale: "en",
    });
    expect(result.safetyFlags.category).toBe("urgent");
  });

  it("falls back to 'no reliable information' when retrieval is below threshold", async () => {
    const deps = baseDeps({ retrieveFn: async () => [] });
    const result = await runAssistantPipeline(deps, {
      userId: "test-user",
      message: "What foods help with cramps?",
      locale: "en",
    });
    expect(result.safetyFlags.retrieval).toBe("below_threshold");
    expect(result.sources).toEqual([]);
  });
});

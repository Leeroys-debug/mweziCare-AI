import { generateObject } from "ai";
import { z } from "zod";

export type Classification =
  "urgent" | "in_scope" | "out_of_scope" | "self_harm";

/**
 * Injectable so tests can substitute a fake without calling a real model —
 * see src/pipeline.test.ts's FakeClassifier, which always returns
 * "in_scope" to prove the deterministic keyword/rules-engine pre-filter
 * (redflag-screen.ts, self-harm-keywords.ts) catches every urgent/self-harm
 * case on its own.
 */
export interface Classifier {
  classify(text: string, locale: string): Promise<Classification>;
}

const classificationSchema = z.object({
  category: z.enum(["urgent", "in_scope", "out_of_scope", "self_harm"]),
});

export class GatewayClassifier implements Classifier {
  constructor(private readonly model: string) {}

  async classify(text: string, locale: string): Promise<Classification> {
    const { object } = await generateObject({
      model: this.model,
      schema: classificationSchema,
      system:
        "Classify a message sent to a menstrual-health education assistant for girls and young " +
        "women in Kenya. Categories: " +
        "'urgent' — describes a medical emergency needing care right now (e.g. sudden severe pain, " +
        "fainting, heavy bleeding with dizziness, severe pain with possible pregnancy); " +
        "'self_harm' — expresses suicidal ideation or intent to self-harm; " +
        "'in_scope' — a menstrual/reproductive health question the assistant can try to answer; " +
        "'out_of_scope' — anything else (small talk, unrelated topics, requests for diagnosis of an " +
        "unrelated condition, etc). The message is in locale '" +
        locale +
        "'. When in doubt between urgent/self_harm and something milder, prefer the more cautious " +
        "category.",
      prompt: text,
    });
    return object.category;
  }
}

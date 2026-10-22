import { describe, expect, it } from "vitest";
import {
  analyticsEventSchemas,
  analyticsEventTypes,
  parseAnalyticsEventProps,
} from "./analytics-events";

describe("analyticsEventSchemas", () => {
  it("covers every event type named in the spec", () => {
    expect(analyticsEventTypes.sort()).toEqual(
      [
        "signup_completed",
        "log_saved",
        "assessment_generated",
        "urgent_screen_shown",
        "facility_search",
        "referral_recorded",
        "summary_created",
        "summary_viewed",
        "chat_message",
        "knowledge_quiz_completed",
      ].sort(),
    );
  });

  it("rejects an unknown/disallowed prop on every event type", () => {
    for (const eventType of analyticsEventTypes) {
      expect(() =>
        analyticsEventSchemas[eventType].parse({
          notAllowed: "free text leak",
        }),
      ).toThrow();
    }
  });

  it("rejects free text, coordinates, or anything beyond the whitelisted shape", () => {
    expect(() =>
      parseAnalyticsEventProps("facility_search", {
        mode: "geo",
        resultCount: 3,
        verifiedCount: 1,
        lat: -1.28,
        lng: 36.8,
      }),
    ).toThrow();
    expect(() =>
      parseAnalyticsEventProps("chat_message", {
        inScope: true,
        messageText: "what is this",
      }),
    ).toThrow();
    expect(() =>
      parseAnalyticsEventProps("assessment_generated", {
        outcome: "urgent",
        reasons: ["free text"],
      }),
    ).toThrow();
  });

  it("accepts exactly the whitelisted shape per event type", () => {
    expect(
      parseAnalyticsEventProps("assessment_generated", {
        outcome: "assess_soon",
      }),
    ).toEqual({
      outcome: "assess_soon",
    });
    expect(
      parseAnalyticsEventProps("facility_search", {
        mode: "area",
        resultCount: 5,
        verifiedCount: 2,
      }),
    ).toEqual({ mode: "area", resultCount: 5, verifiedCount: 2 });
    expect(parseAnalyticsEventProps("log_saved", {})).toEqual({});
    expect(parseAnalyticsEventProps("log_saved", undefined)).toEqual({});
  });

  it("rejects an invalid outcome enum value", () => {
    expect(() =>
      parseAnalyticsEventProps("assessment_generated", { outcome: "critical" }),
    ).toThrow();
  });
});

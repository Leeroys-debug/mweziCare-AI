import { describe, expect, it } from "vitest";
import { scrubSentryEvent } from "./sentry-scrub";

describe("scrubSentryEvent", () => {
  it("strips the request body, cookies, headers, and query string, keeping only url/method", () => {
    const event = {
      request: {
        url: "https://app.mwezicare.org/api/v1/chat",
        method: "POST",
        data: { message: "I have severe cramps" },
        cookies: { "better-auth.session_token": "secret" },
        headers: { authorization: "Bearer xyz" },
        query_string: "foo=bar",
      },
    };

    const scrubbed = scrubSentryEvent(event);

    expect(scrubbed.request).toEqual({
      url: "https://app.mwezicare.org/api/v1/chat",
      method: "POST",
    });
  });

  it("redacts phone/email/notes/content/lat/lng wherever they appear in user/extra/contexts/tags", () => {
    const event = {
      user: { id: "u1", phone: "+254700000000", email: "a@b.com" },
      extra: { notes: "fainting episode", safe: "kept" },
      contexts: { location: { lat: -1.28, lng: 36.81 } },
      tags: { content: "chat-message-body", locale: "en" },
    };

    const scrubbed = scrubSentryEvent(event) as typeof event;

    expect(scrubbed.user).toEqual({
      id: "u1",
      phone: "[redacted]",
      email: "[redacted]",
    });
    expect(scrubbed.extra).toEqual({ notes: "[redacted]", safe: "kept" });
    expect(scrubbed.contexts).toEqual({
      location: { lat: "[redacted]", lng: "[redacted]" },
    });
    expect(scrubbed.tags).toEqual({ content: "[redacted]", locale: "en" });
  });

  it("is a no-op when none of the scrubbed fields are present", () => {
    const event = { message: "generic error", level: "error" };
    expect(scrubSentryEvent(event)).toEqual(event);
  });
});

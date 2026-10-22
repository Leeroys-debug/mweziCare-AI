import { describe, expect, it } from "vitest";
import { loadFixedResponse } from "./fixed-responses";

describe("loadFixedResponse", () => {
  it("loads the English urgent response with CLINICAL REVIEW markers intact", async () => {
    const response = await loadFixedResponse("urgent", "en");
    expect(response.title).toBeTruthy();
    expect(response.body).toContain("[CLINICAL REVIEW REQUIRED]");
  });

  it("loads the Swahili self-harm response", async () => {
    const response = await loadFixedResponse("self-harm", "sw");
    expect(response.body.length).toBeGreaterThan(0);
  });
});

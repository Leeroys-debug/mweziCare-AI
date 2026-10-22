import { describe, expect, it } from "vitest";
import {
  deriveCycles,
  extractFeatures,
  extractRedFlagFeatures,
  summarizeCyclesForCharts,
} from "./index";

describe("@mwezicare/triage barrel", () => {
  it("exports cycles, features and insights functions", () => {
    expect(typeof deriveCycles).toBe("function");
    expect(typeof extractFeatures).toBe("function");
    expect(typeof extractRedFlagFeatures).toBe("function");
    expect(typeof summarizeCyclesForCharts).toBe("function");
  });
});

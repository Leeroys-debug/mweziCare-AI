import { describe, expect, it } from "vitest";
import {
  averageForLatestWeek,
  groupedForLatestWeek,
  latestWeek,
  sumByWeek,
  totalForLatestWeek,
} from "./aggregate";

const rows = [
  {
    week: "2026-01-05",
    county: "Kiambu",
    age_band: "18-20",
    active_users: "12",
  },
  {
    week: "2026-01-05",
    county: "Nairobi",
    age_band: "21-24",
    active_users: "15",
  },
  {
    week: "2026-01-12",
    county: "Kiambu",
    age_band: "18-20",
    active_users: "20",
  },
];

describe("dashboard aggregate helpers", () => {
  it("latestWeek picks the most recent week", () => {
    expect(latestWeek(rows)).toBe("2026-01-12");
    expect(latestWeek([])).toBeNull();
  });

  it("sumByWeek totals a numeric column per week, sorted ascending", () => {
    expect(sumByWeek(rows, "active_users")).toEqual([
      { week: "2026-01-05", value: 27 },
      { week: "2026-01-12", value: 20 },
    ]);
  });

  it("totalForLatestWeek only sums the most recent week's rows", () => {
    expect(totalForLatestWeek(rows, "active_users")).toBe(20);
  });

  it("averageForLatestWeek averages across the most recent week's rows", () => {
    const multi = [
      { week: "2026-01-12", logs_per_active_user: "2" },
      { week: "2026-01-12", logs_per_active_user: "4" },
    ];
    expect(averageForLatestWeek(multi, "logs_per_active_user")).toBe(3);
  });

  it("groupedForLatestWeek sums per group within the most recent week only", () => {
    const outcomeRows = [
      { week: "2026-01-05", outcome: "routine", assessment_count: "5" },
      { week: "2026-01-12", outcome: "routine", assessment_count: "3" },
      { week: "2026-01-12", outcome: "urgent", assessment_count: "1" },
    ];
    expect(
      groupedForLatestWeek(outcomeRows, "outcome", "assessment_count"),
    ).toEqual([
      { group: "routine", value: 3 },
      { group: "urgent", value: 1 },
    ]);
  });

  it("returns zero/empty for no rows", () => {
    expect(totalForLatestWeek([], "active_users")).toBe(0);
    expect(averageForLatestWeek([], "active_users")).toBe(0);
    expect(groupedForLatestWeek([], "outcome", "count")).toEqual([]);
  });
});

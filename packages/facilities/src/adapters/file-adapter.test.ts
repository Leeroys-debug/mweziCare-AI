import path from "node:path";
import { describe, expect, it } from "vitest";
import { FileAdapter } from "./file-adapter";

const fixturesDir = path.join(import.meta.dirname, "..", "fixtures");

describe("FileAdapter", () => {
  it("parses a CSV extract", async () => {
    const adapter = new FileAdapter(
      path.join(fixturesDir, "sample-extract.csv"),
    );
    const records = await adapter.fetchFacilities();

    expect(records).toHaveLength(2);
    expect(records[0]).toEqual({
      kmhflCode: "TEST-001",
      name: "Kiambu Test Health Centre",
      county: "Kiambu",
      subCounty: "Kiambu",
      lat: -1.1714,
      lng: 36.8356,
      phone: "+254700010001",
      kephLevel: "Level 3",
      ownership: "public",
      services: [{ serviceCode: "GYN" }, { serviceCode: "OPD" }],
    });
    expect(records[1]?.services).toEqual([{ serviceCode: "OPD" }]);
  });

  it("parses a GeoJSON extract", async () => {
    const adapter = new FileAdapter(
      path.join(fixturesDir, "sample-extract.geojson"),
    );
    const records = await adapter.fetchFacilities();

    expect(records).toHaveLength(1);
    expect(records[0]).toEqual({
      kmhflCode: "TEST-003",
      name: "Ruiru Test Dispensary",
      county: "Kiambu",
      subCounty: "Ruiru",
      lat: -1.1714,
      lng: 36.8356,
      phone: "+254700010003",
      kephLevel: "Level 2",
      ownership: "faith-based",
      services: [{ serviceCode: "GYN" }],
    });
  });

  it("rejects an unsupported file extension", async () => {
    const adapter = new FileAdapter(
      path.join(fixturesDir, "sample-extract.txt"),
    );
    await expect(adapter.fetchFacilities()).rejects.toThrow(/unsupported/i);
  });
});

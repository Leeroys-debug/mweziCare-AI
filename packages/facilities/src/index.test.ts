import { describe, expect, it } from "vitest";
import { FileAdapter, geoSearch, areaSearch, importFacilities } from "./index";

describe("@mwezicare/facilities barrel", () => {
  it("exports the file adapter, importer and search functions", () => {
    expect(typeof FileAdapter).toBe("function");
    expect(typeof geoSearch).toBe("function");
    expect(typeof areaSearch).toBe("function");
    expect(typeof importFacilities).toBe("function");
  });
});

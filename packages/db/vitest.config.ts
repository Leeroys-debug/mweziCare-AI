import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Default 5000ms is tight for these DB-backed tests when all 8
    // workspace packages' test suites run in parallel (turbo) and compete
    // for CPU/IO — seen flaking under that load even though each test is
    // well under 5s in isolation.
    testTimeout: 15_000,
  },
});

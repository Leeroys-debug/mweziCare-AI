import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**", "e2e/**"],
    // Default 5000ms is tight for these DB-backed route tests when all 8
    // workspace packages' test suites run in parallel (turbo) and compete
    // for CPU/IO — seen flaking under that load even though each test is
    // well under 5s in isolation.
    testTimeout: 15_000,
  },
});

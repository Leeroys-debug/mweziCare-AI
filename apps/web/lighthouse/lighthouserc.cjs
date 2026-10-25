// Performance budget for /en/track (E2 spec): < 170 KB compressed JS on
// first load, LCP < 3s, CLS < 0.1, measured on a simulated slow-4G mobile
// profile. Run via `pnpm lighthouse` (apps/web/scripts/run-lighthouse.mjs
// builds + starts the app and invokes `lhci autorun` with this config) or
// the .github/workflows/lighthouse.yml CI job.
const KB_170_IN_BYTES = 170 * 1024;

module.exports = {
  ci: {
    collect: {
      url: ["http://localhost:3000/en/track"],
      numberOfRuns: 1,
      settings: {
        onlyCategories: ["performance"],
        formFactor: "mobile",
        screenEmulation: { mobile: true, width: 360, height: 640, deviceScaleFactor: 2, disabled: false },
        // Lighthouse's own "slow 4G" throttling preset.
        throttlingMethod: "simulate",
        throttling: {
          rttMs: 150,
          throughputKbps: 1638.4,
          cpuSlowdownMultiplier: 4,
          requestLatencyMs: 562.5,
          downloadThroughputKbps: 1474.56,
          uploadThroughputKbps: 675,
        },
        // Signs up via the real email+password flow first — /en/track sits
        // behind requireUser() (see ./auth.cjs).
        puppeteerScript: "./lighthouse/auth.cjs",
      },
    },
    assert: {
      assertions: {
        "resource-summary:script:size": ["error", { maxNumericValue: KB_170_IN_BYTES }],
        "largest-contentful-paint": ["error", { maxNumericValue: 3000 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: "./.lighthouseci",
    },
  },
};

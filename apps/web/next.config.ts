import path from "node:path";
import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import createNextIntlPlugin from "next-intl/plugin";
import withSerwistInit from "@serwist/next";
import { withSentryConfig } from "@sentry/nextjs/config";

// Monorepo root keeps the single .env / docker-compose.yml; Next.js only
// auto-loads .env from this app's own directory, so load the root one too.
loadEnvConfig(path.join(process.cwd(), "..", ".."));

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");
const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
});

const nextConfig: NextConfig = {
  // Self-contained server bundle (.next/standalone) — Dockerfile's `web`
  // runtime stage copies just that output, not the whole workspace.
  output: "standalone",
  // Monorepo: workspace packages (@mwezicare/db etc.) are pnpm symlinks
  // living above this app's directory — without this, file tracing for
  // `output: "standalone"` would miss them.
  outputFileTracingRoot: path.join(process.cwd(), "..", ".."),
  transpilePackages: [
    "@mwezicare/ui",
    "@mwezicare/validation",
    "@mwezicare/db",
    "@mwezicare/rules-engine",
    "@mwezicare/triage",
    "@mwezicare/assistant",
    "@mwezicare/facilities",
  ],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        // Public clinician-summary share links — never indexed, never
        // leak the token to a third party via the Referer header.
        source: "/s/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

const configWithPlugins = withSerwist(withNextIntl(nextConfig));

// Only wrap with Sentry's build plugin (source-map upload, etc.) when a DSN
// is actually configured — keeps local dev/CI builds silent and unaffected
// when this project has no Sentry project wired up yet.
export default process.env.SENTRY_DSN
  ? withSentryConfig(configWithPlugins, {
      silent: true,
      // [REVIEW REQUIRED] Set org/project once a Sentry project exists —
      // source-map upload needs SENTRY_AUTH_TOKEN in CI as well.
      widenClientFileUpload: false,
    })
  : configWithPlugins;

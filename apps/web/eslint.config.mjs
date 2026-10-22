import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
// Use the base shared config, not the "next" variant — eslint-config-next
// already registers the jsx-a11y plugin, and loading it twice conflicts.
import shared from "@mwezicare/eslint-config";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...shared,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
    // Plain Node CommonJS scripts outside the app's TS/ESM source — @lhci/cli
    // loads lighthouse/auth.cjs itself via require(), so it can't be ESM.
    "lighthouse/**/*.cjs",
    // Serwist's build-generated service worker bundle (gitignored — see
    // .gitignore) — minified output, not source, and ESLint doesn't
    // consult .gitignore on its own.
    "public/sw.js",
    "public/sw.js.map",
    "public/swe-worker-*.js",
  ]),
]);

export default eslintConfig;

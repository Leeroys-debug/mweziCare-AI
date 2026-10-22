import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Lets the dev-only ConsoleSmsSender (lib/sms.ts) write OTP codes to a file
// e2e/auth.spec.ts can read, instead of a production-shaped backdoor.
export const OTP_CAPTURE_DIR = path.join(__dirname, ".otp-test-capture");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { OTP_TEST_CAPTURE_DIR: OTP_CAPTURE_DIR },
  },
});

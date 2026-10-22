// Authenticates Lighthouse's Puppeteer session before it collects
// /en/track, which sits behind requireUser() — an anonymous request would
// just measure the sign-in redirect instead of the real page. Reuses the
// same dev-only OTP-capture trick apps/web/e2e/*.spec.ts already use
// (lib/sms.ts's ConsoleSmsSender writes the code to OTP_TEST_CAPTURE_DIR
// instead of sending a real SMS) — scripts/run-lighthouse.mjs sets that
// env var on the server process it starts, pointing at the same directory
// this script reads from.
"use strict";

const { readFile } = require("node:fs/promises");
const path = require("node:path");

const OTP_CAPTURE_DIR = path.join(__dirname, "..", ".lighthouse-otp-capture");

async function readCapturedOtp(e164Phone) {
  const file = path.join(OTP_CAPTURE_DIR, `${encodeURIComponent(e164Phone)}.txt`);
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      return (await readFile(file, "utf8")).trim();
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`Timed out waiting for OTP capture file: ${file}`);
}

/** @type {(browser: import('puppeteer').Browser, context: {url: string}) => Promise<void>} */
module.exports = async (browser, context) => {
  const origin = new URL(context.url).origin;
  const page = await browser.newPage();

  const localPhone = `07${Date.now().toString().slice(-8)}`;
  const e164Phone = `+254${localPhone.slice(1)}`;

  await page.goto(`${origin}/en/sign-in`, { waitUntil: "networkidle0" });
  await page.type('input[type="tel"]', localPhone);
  await page.click('button[type="submit"]');

  await page.waitForSelector('input[autocomplete="one-time-code"]', { timeout: 15000 });
  const code = await readCapturedOtp(e164Phone);
  await page.type('input[autocomplete="one-time-code"]', code);

  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0" }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);

  await page.close();
};

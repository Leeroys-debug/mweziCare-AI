// Authenticates Lighthouse's Puppeteer session before it collects
// /en/track, which sits behind requireUser() — an anonymous request would
// just measure the sign-in redirect instead of the real page. Signs up a
// fresh email+password account via the real /en/sign-up form; no OTP
// capture backdoor needed since there's no OTP step anymore.
"use strict";

/** @type {(browser: import('puppeteer').Browser, context: {url: string}) => Promise<void>} */
module.exports = async (browser, context) => {
  const origin = new URL(context.url).origin;
  const page = await browser.newPage();

  const email = `lighthouse-${Date.now()}@example.com`;

  await page.goto(`${origin}/en/sign-up`, { waitUntil: "networkidle0" });
  await page.type('input[autocomplete="name"]', "Lighthouse Test User");
  await page.type('input[autocomplete="email"]', email);
  await page.type('input[autocomplete="new-password"]', "lighthouse-test-password-1");

  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0" }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);

  await page.close();
};

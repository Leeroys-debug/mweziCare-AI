#!/usr/bin/env node
// Builds a production bundle, starts it with the dev-only OTP capture
// backdoor enabled (so lighthouse/auth.cjs can sign in), runs `lhci
// autorun` against it, then tears the server down — all in Node so it
// works the same on Windows/macOS/Linux and in CI (no shell-specific
// `VAR=value command` syntax, which breaks on Windows).
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const otpCaptureDir = path.join(appRoot, ".lighthouse-otp-capture");
const port = process.env.PORT ?? "3000";
const baseUrl = `http://localhost:${port}`;

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: true, cwd: appRoot, ...options });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function waitForServer(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

async function main() {
  console.log("[lighthouse] Building production bundle...");
  await run("pnpm", ["run", "build"]);

  console.log("[lighthouse] Starting production server...");
  const server = spawn("pnpm", ["run", "start"], {
    cwd: appRoot,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, OTP_TEST_CAPTURE_DIR: otpCaptureDir, PORT: port },
  });
  server.on("error", (error) => {
    console.error("[lighthouse] Failed to start server", error);
    process.exit(1);
  });

  try {
    await waitForServer(`${baseUrl}/en/sign-in`, 60_000);
    console.log("[lighthouse] Server ready — running Lighthouse CI...");
    await run("npx", ["lhci", "autorun", "--config=lighthouse/lighthouserc.cjs"]);
    console.log("[lighthouse] Budget passed.");
  } finally {
    server.kill();
  }
}

main().catch((error) => {
  console.error("[lighthouse]", error);
  process.exit(1);
});

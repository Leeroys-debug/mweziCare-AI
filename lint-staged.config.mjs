import { existsSync } from "node:fs";
import path from "node:path";

// ESLint 9's flat config is resolved from the process's cwd only (no
// per-file upward walk, unlike the old .eslintrc cascade) — confirmed by
// running `eslint <file>` from the repo root, which fails with "couldn't
// find an eslint.config" even though the target file's own package has
// one. lint-staged runs its commands from the repo root by default, so a
// plain `eslint --fix` here fails for every file in this pnpm workspace.
// This groups staged files by the nearest ancestor directory that actually
// has an eslint.config.*, and points eslint at that config explicitly via
// `--config` — lint-staged runs task commands through execa *without* a
// shell, so a `cd dir && eslint ...` trick doesn't work: there's no shell
// to interpret `&&`, and Windows fails the whole string with "the system
// cannot find the path specified".
const CONFIG_NAMES = ["eslint.config.js", "eslint.config.mjs", "eslint.config.cjs"];

function findConfig(filename) {
  let dir = path.dirname(path.resolve(filename));
  const root = path.parse(dir).root;
  while (dir !== root) {
    for (const name of CONFIG_NAMES) {
      const configPath = path.join(dir, name);
      if (existsSync(configPath)) return configPath;
    }
    dir = path.dirname(dir);
  }
  return null;
}

function eslintPerPackage(filenames) {
  const groups = new Map();
  for (const filename of filenames) {
    const configPath = findConfig(filename);
    if (!configPath) continue; // no eslint.config.* found upward — nothing to run
    if (!groups.has(configPath)) groups.set(configPath, []);
    groups.get(configPath).push(path.resolve(filename));
  }

  return Array.from(groups.entries()).map(([configPath, files]) => {
    const quoted = files.map((f) => JSON.stringify(f)).join(" ");
    return `eslint --fix --config ${JSON.stringify(configPath)} ${quoted}`;
  });
}

export default {
  "*.{ts,tsx,js,jsx}": eslintPerPackage,
  "*.{ts,tsx,js,jsx,json,md,css}": (filenames) =>
    `prettier --write ${filenames.map((f) => JSON.stringify(f)).join(" ")}`,
};

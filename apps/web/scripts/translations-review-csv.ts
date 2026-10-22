import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { flattenMessages } from "../lib/flatten-messages";

const appRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outPath = path.join(
  appRoot,
  "..",
  "..",
  "docs",
  "translations-review.csv",
);

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Generates docs/translations-review.csv (key, en, sw, context) for a human
 * translator to review quality — en.json/sw.json already have full key
 * parity (apps/web/lib/i18n-parity.test.ts enforces that), this is a
 * review pass, not a completeness pass.
 */
async function main() {
  const en = JSON.parse(
    await readFile(path.join(appRoot, "messages", "en.json"), "utf8"),
  );
  const sw = JSON.parse(
    await readFile(path.join(appRoot, "messages", "sw.json"), "utf8"),
  );
  const enFlat = flattenMessages(en);
  const swFlat = flattenMessages(sw);

  const rows = Object.keys(enFlat)
    .sort()
    .map((key) => {
      const context = key.split(".")[0]!;
      return [key, enFlat[key] ?? "", swFlat[key] ?? "", context];
    });

  const lines = [
    ["key", "en", "sw", "context"].join(","),
    ...rows.map((row) => row.map(csvCell).join(",")),
  ];

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, lines.join("\n") + "\n", "utf8");
  console.log(`Wrote ${rows.length} rows to ${outPath}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

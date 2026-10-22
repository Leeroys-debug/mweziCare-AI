import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parseFrontMatter } from "./frontmatter";
import type { Article } from "./types";

/**
 * repoRoot/content — resolved relative to this file rather than
 * process.cwd(), so it works the same whether invoked from the package's
 * own script, the worker, or a test.
 */
export function defaultContentRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..", "..", "..", "content");
}

/**
 * Loads every top-level *.md file in content/{locale}/ (not recursive, so
 * content/{locale}/safety/*.md — the fixed safety responses, loaded
 * separately by safety/fixed-responses.ts — are never picked up as
 * retrievable KB articles).
 */
export async function loadArticles(
  contentRoot: string,
  locale: string,
): Promise<Article[]> {
  const dir = path.join(contentRoot, locale);
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const articles: Article[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".md")) continue;
    const sourcePath = path.join(dir, entry);
    const raw = await readFile(sourcePath, "utf8");
    const { frontMatter, body } = parseFrontMatter(raw);
    articles.push({ ...frontMatter, body, sourcePath });
  }
  return articles;
}

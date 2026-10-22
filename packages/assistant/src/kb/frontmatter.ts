import type { ArticleFrontMatter, ArticleStatus } from "./types";

const DELIMITER = "---";

/**
 * Minimal flat front-matter parser for content/{locale}/*.md — every KB
 * article uses the same flat `key: value` shape (see content/en/*.md), so a
 * full YAML parser would be a dependency for nothing. Not meant to handle
 * nested structures, lists, or quoted strings beyond simple trimming.
 */
export function parseFrontMatter(raw: string): {
  frontMatter: ArticleFrontMatter;
  body: string;
} {
  const lines = raw.split(/\r?\n/);
  if (lines[0]?.trim() !== DELIMITER) {
    throw new Error("Article is missing opening '---' front matter delimiter");
  }

  const closingIndex = lines.findIndex(
    (line, i) => i > 0 && line.trim() === DELIMITER,
  );
  if (closingIndex === -1) {
    throw new Error("Article is missing closing '---' front matter delimiter");
  }

  const fields: Record<string, string> = {};
  for (const line of lines.slice(1, closingIndex)) {
    if (!line.trim()) continue;
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();
    fields[key] = value;
  }

  const body = lines
    .slice(closingIndex + 1)
    .join("\n")
    .trim();

  const status =
    fields.status === "approved" ? "approved" : ("draft" as ArticleStatus);
  if (!fields.title || !fields.slug || !fields.locale) {
    throw new Error("Article front matter must include title, slug and locale");
  }

  return {
    frontMatter: {
      title: fields.title,
      slug: fields.slug,
      locale: fields.locale,
      status,
      reviewedBy: fields.reviewed_by || null,
      reviewDue: fields.review_due || null,
    },
    body,
  };
}

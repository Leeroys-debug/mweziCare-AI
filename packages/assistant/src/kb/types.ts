export type ArticleStatus = "draft" | "approved";

/** Front matter for a content/{locale}/*.md knowledge-base article. */
export interface ArticleFrontMatter {
  title: string;
  slug: string;
  locale: string;
  status: ArticleStatus;
  reviewedBy: string | null;
  reviewDue: string | null;
}

export interface Article extends ArticleFrontMatter {
  body: string;
  /** Absolute path the article was loaded from — for error messages only. */
  sourcePath: string;
}

export interface Chunk {
  chunkIndex: number;
  content: string;
}

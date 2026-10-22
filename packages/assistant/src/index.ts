// RAG retrieval, prompts and safety filters for the conversational
// assistant. The assistant never decides triage urgency — it defers to
// @mwezicare/rules-engine for every red-flag check (CLAUDE.md).

export * from "./kb/types";
export * from "./kb/frontmatter";
export * from "./kb/chunk";
export * from "./kb/embeddings";
export * from "./kb/load-articles";
export * from "./kb/ingest";

export * from "./safety/redflag-screen";
export * from "./safety/self-harm-keywords";
export * from "./safety/classify";
export * from "./safety/fixed-responses";

export * from "./retrieval";
export * from "./prompt";
export * from "./postfilter";
export * from "./persist";
export * from "./pipeline";

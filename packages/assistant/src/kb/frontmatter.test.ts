import { describe, expect, it } from "vitest";
import { parseFrontMatter } from "./frontmatter";

describe("parseFrontMatter", () => {
  it("parses a well-formed article", () => {
    const raw = `---
title: What is a normal period?
slug: what-is-a-normal-period
locale: en
status: approved
reviewed_by: Dr. Jane
review_due: 2027-01-01
---

Body text here.
Second line.`;

    const { frontMatter, body } = parseFrontMatter(raw);
    expect(frontMatter).toEqual({
      title: "What is a normal period?",
      slug: "what-is-a-normal-period",
      locale: "en",
      status: "approved",
      reviewedBy: "Dr. Jane",
      reviewDue: "2027-01-01",
    });
    expect(body).toBe("Body text here.\nSecond line.");
  });

  it("defaults status to draft and nullable fields to null when blank", () => {
    const raw = `---
title: Myths
slug: myths
locale: sw
status: draft
reviewed_by:
review_due:
---

Body.`;
    const { frontMatter } = parseFrontMatter(raw);
    expect(frontMatter.status).toBe("draft");
    expect(frontMatter.reviewedBy).toBeNull();
    expect(frontMatter.reviewDue).toBeNull();
  });

  it("throws when the opening delimiter is missing", () => {
    expect(() => parseFrontMatter("title: x\n---\nbody")).toThrow(/opening/);
  });

  it("throws when required fields are missing", () => {
    const raw = `---
title: Only a title
---

Body.`;
    expect(() => parseFrontMatter(raw)).toThrow(/title, slug and locale/);
  });
});

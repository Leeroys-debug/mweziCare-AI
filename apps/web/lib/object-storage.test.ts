import { config } from "dotenv";
import { describe, expect, it } from "vitest";

config({ path: "../../.env" });

// Integration test against the real local Garage (S3-compatible) container
// — see infra/garage/bootstrap.sh / `pnpm storage:init`. Skips instead of
// failing when S3 isn't configured, so `pnpm test` still passes without it.
const hasS3Config = Boolean(
  process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY,
);

describe.skipIf(!hasS3Config)("object-storage", () => {
  it("round-trips a PDF through put + a presigned download URL", async () => {
    const { putPdf, getPresignedDownloadUrl } =
      await import("./object-storage");

    const key = `test/${Date.now()}.pdf`;
    const body = Buffer.from("%PDF-1.4\ntest content\n%%EOF");
    await putPdf(key, body);

    const url = await getPresignedDownloadUrl(key, 60);
    expect(url).toContain(key);

    const response = await fetch(url);
    expect(response.status).toBe(200);
    const downloaded = Buffer.from(await response.arrayBuffer());
    expect(downloaded.equals(body)).toBe(true);
  });
});

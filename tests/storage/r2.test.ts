import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isR2Configured, presignPut } from "@/lib/storage/r2";

/** R2 の署名付き URL(種類と大きさを署名に含めること)。 */
describe("presignPut", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    process.env.R2_ACCOUNT_ID = "0123abcd";
    process.env.R2_ACCESS_KEY_ID = "AKIDEXAMPLE";
    process.env.R2_SECRET_ACCESS_KEY = "secret";
    process.env.R2_BUCKET = "redice-media";
    process.env.NEXT_PUBLIC_MEDIA_BASE_URL = "https://media.example.com/";
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("R2 のバケットへの PUT URL と公開 URL を返す", () => {
    expect(isR2Configured()).toBe(true);
    const r = presignPut({ key: "u1/abc.png", contentType: "image/png", contentLength: 1234 })!;
    const url = new URL(r.uploadUrl);
    expect(url.host).toBe("0123abcd.r2.cloudflarestorage.com");
    expect(url.pathname).toBe("/redice-media/u1/abc.png");
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("content-length;content-type;host");
    expect(url.searchParams.get("X-Amz-Credential")).toMatch(/^AKIDEXAMPLE\/\d{8}\/auto\/s3\/aws4_request$/);
    expect(url.searchParams.get("X-Amz-Expires")).toBe("600");
    expect(r.publicUrl).toBe("https://media.example.com/u1/abc.png");
  });

  it("設定が欠けていれば使わない", () => {
    delete process.env.R2_BUCKET;
    expect(isR2Configured()).toBe(false);
    expect(presignPut({ key: "u1/a.png", contentType: "image/png", contentLength: 1 })).toBeNull();
  });
});

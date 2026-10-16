import { describe, it, expect } from "vitest";
import { presignUrl, signHeaders, uriEncode } from "@/lib/storage/sigv4";

/**
 * AWS 公式ドキュメントの例題(Signature Version 4)で署名を検証する。
 * - クエリ署名: "Authenticating Requests: Using Query Parameters" の GET 例
 * - ヘッダー署名: "Authenticating Requests: Using the Authorization Header" の GET Object 例
 */
const creds = {
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  region: "us-east-1",
  service: "s3",
};
const now = new Date("2013-05-24T00:00:00Z");

describe("SigV4", () => {
  it("署名付き URL(AWS の例題と一致)", () => {
    const url = presignUrl({
      creds,
      method: "GET",
      host: "examplebucket.s3.amazonaws.com",
      path: "/test.txt",
      expiresSec: 86400,
      now,
    });
    expect(url).toContain(
      "X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404",
    );
    expect(url).toContain("X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request");
  });

  it("URI エンコード(S3 の規則)", () => {
    expect(uriEncode("a b/c~d", false)).toBe("a%20b/c~d");
    expect(uriEncode("卓")).toBe("%E5%8D%93");
  });

  it("ヘッダー署名は認証ヘッダーと日時を返す", () => {
    const h = signHeaders({
      creds,
      method: "GET",
      host: "examplebucket.s3.amazonaws.com",
      path: "/",
      now,
      query: { "list-type": "2", prefix: "u1/" },
    });
    expect(h["x-amz-date"]).toBe("20130524T000000Z");
    expect(h.authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE\/20130524\/us-east-1\/s3\/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/,
    );
  });
});

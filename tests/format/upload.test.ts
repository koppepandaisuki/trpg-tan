import { describe, it, expect } from "vitest";
import { AVATAR_MAX_BYTES, mimeToAvatarExt } from "@/lib/format/upload";

/**
 * アバターアップロードの純関数。2026-09 のストア廃止で表紙・作品ファイル用の
 * 変換は撤去され、このモジュールに残るのはアバターだけ。
 */

describe("AVATAR_MAX_BYTES", () => {
  it("is exactly 2 MB (matches the avatars bucket setting)", () => {
    expect(AVATAR_MAX_BYTES).toBe(2 * 1024 * 1024);
  });
});

describe("mimeToAvatarExt", () => {
  it("maps the three allowed image types", () => {
    expect(mimeToAvatarExt("image/png")).toBe("png");
    expect(mimeToAvatarExt("image/jpeg")).toBe("jpg");
    expect(mimeToAvatarExt("image/webp")).toBe("webp");
  });

  it("is case-insensitive on the MIME string", () => {
    expect(mimeToAvatarExt("IMAGE/PNG")).toBe("png");
  });

  it("rejects other image types and non-images", () => {
    expect(mimeToAvatarExt("image/gif")).toBeNull();
    expect(mimeToAvatarExt("image/svg+xml")).toBeNull();
    expect(mimeToAvatarExt("application/pdf")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(mimeToAvatarExt("")).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import { getLoginErrorMessage } from "@/lib/auth/login-errors";

describe("getLoginErrorMessage", () => {
  it("returns null when both error and error_code are undefined", () => {
    expect(getLoginErrorMessage(undefined, undefined)).toBeNull();
  });

  it("returns null when both are empty strings", () => {
    expect(getLoginErrorMessage("", "")).toBeNull();
  });

  it("returns mapped message for known error_code (otp_expired)", () => {
    const msg = getLoginErrorMessage(undefined, "otp_expired");
    expect(msg).not.toBeNull();
    expect(msg).toContain("有効期限");
  });

  it("returns mapped message for known error (missing_code)", () => {
    const msg = getLoginErrorMessage("missing_code", undefined);
    expect(msg).toContain("認証コード");
  });

  it("returns mapped message for known error (callback_failed)", () => {
    const msg = getLoginErrorMessage("callback_failed", undefined);
    expect(msg).toContain("認証処理");
  });

  it("returns mapped message for access_denied", () => {
    const msg = getLoginErrorMessage("access_denied", undefined);
    expect(msg).toContain("アクセス");
  });

  it("prefers error_code over error when both present", () => {
    // Supabase は両方付けてくる:error=access_denied + error_code=otp_expired
    // → error_code(より具体的)の方を優先
    const msg = getLoginErrorMessage("access_denied", "otp_expired");
    expect(msg).toContain("有効期限");
  });

  it("returns generic fallback for unknown codes (with code name)", () => {
    const msg = getLoginErrorMessage(undefined, "unknown_code_xyz");
    expect(msg).not.toBeNull();
    expect(msg).toContain("エラー");
    expect(msg).toContain("unknown_code_xyz");
  });
});

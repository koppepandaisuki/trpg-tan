import { describe, it, expect } from "vitest";
import { AdminRpcError, classifyRpcError } from "@/lib/mutations/admin";

describe("classifyRpcError", () => {
  it("classifies 'unauthenticated' messages", () => {
    const err = classifyRpcError("grant_creator", { message: "unauthenticated" });
    expect(err).toBeInstanceOf(AdminRpcError);
    expect(err.action).toBe("grant_creator");
    expect(err.reason).toBe("unauthenticated");
    expect(err.message).toBe("認証が必要です");
  });

  it("classifies 'forbidden' messages", () => {
    expect(
      classifyRpcError("revoke_creator", { message: "forbidden" }).reason,
    ).toBe("forbidden");
  });

  it("classifies 'cannot modify self' messages", () => {
    const err = classifyRpcError("grant_creator", { message: "cannot modify self" });
    expect(err.reason).toBe("self");
    expect(err.message).toBe("自分自身は変更できません");
  });

  it("classifies 'target not found' messages", () => {
    expect(
      classifyRpcError("set_status", { message: "target not found" }).reason,
    ).toBe("not_found");
  });

  it("classifies 'product not found' messages", () => {
    expect(
      classifyRpcError("set_status", { message: "product not found" }).reason,
    ).toBe("not_found");
  });

  it("classifies 'invalid status' messages", () => {
    expect(
      classifyRpcError("set_status", { message: "invalid status: foo" }).reason,
    ).toBe("invalid");
  });

  it("classifies 'insufficient_balance' messages", () => {
    const err = classifyRpcError("adjust_gold", {
      message: "insufficient_balance",
    });
    expect(err.reason).toBe("invalid");
    expect(err.message).toBe(
      "残高が不足しているため、その金額は減算できません",
    );
  });

  it("classifies 'invalid_amount' messages", () => {
    expect(
      classifyRpcError("adjust_gold", { message: "invalid_amount" }).reason,
    ).toBe("invalid");
  });

  it("falls back to 'unknown' for unrecognized messages", () => {
    const err = classifyRpcError("set_status", { message: "boom" });
    expect(err.reason).toBe("unknown");
    expect(err.message).toBe("操作に失敗しました");
  });

  it("handles missing message field", () => {
    expect(classifyRpcError("grant_creator", {}).reason).toBe("unknown");
  });

  it("is case-insensitive on the haystack", () => {
    expect(
      classifyRpcError("grant_creator", { message: "FORBIDDEN" }).reason,
    ).toBe("forbidden");
  });
});

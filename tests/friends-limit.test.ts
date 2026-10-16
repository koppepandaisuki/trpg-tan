import { describe, it, expect } from "vitest";
import { friendLimitMessage, friendLimitReason } from "@/lib/friends/limit";

describe("friendLimitReason", () => {
  it("DB の上限エラーを自分 / 相手に分ける", () => {
    expect(friendLimitReason({ message: "friend_limit_reached", details: "mine" })).toBe("mine");
    expect(friendLimitReason({ message: "friend_limit_reached", details: "theirs" })).toBe("theirs");
    expect(friendLimitReason({ message: "friend_limit_reached" })).toBe("mine");
  });
  it("ほかのエラーは null", () => {
    expect(friendLimitReason({ message: "not authenticated" })).toBeNull();
    expect(friendLimitReason(null)).toBeNull();
  });
  it("文言に上限の人数が入る", () => {
    expect(friendLimitMessage("mine")).toContain("30 人");
    expect(friendLimitMessage("theirs")).toContain("相手");
  });
});

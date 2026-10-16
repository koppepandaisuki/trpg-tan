import { describe, it, expect } from "vitest";
import { normalizeJoinCode } from "@/components/play/join-code-form";

describe("normalizeJoinCode", () => {
  it("小文字・空白・全角英数をならす(スマホの入力ゆれ)", () => {
    expect(normalizeJoinCode("abc 234")).toBe("ABC234");
    expect(normalizeJoinCode("ＡＢＣ２３４")).toBe("ABC234");
    expect(normalizeJoinCode(" ab\tc2 3 4 ")).toBe("ABC234");
  });
});

import { describe, it, expect } from "vitest";
import { resolveCoCCheck } from "../src/dice/coc-check.js";

describe("resolveCoCCheck — 7版", () => {
  const target = 60; // 1/5=12, 1/2=30

  it("≤ 技能/5 はイクストリーム", () => {
    expect(resolveCoCCheck(12, target, "7").level).toBe("extreme");
    expect(resolveCoCCheck(1, target, "7").level).toBe("extreme");
  });

  it("≤ 技能/2 はハード", () => {
    expect(resolveCoCCheck(13, target, "7").level).toBe("hard");
    expect(resolveCoCCheck(30, target, "7").level).toBe("hard");
  });

  it("≤ 技能 はレギュラー", () => {
    expect(resolveCoCCheck(31, target, "7").level).toBe("regular");
    expect(resolveCoCCheck(60, target, "7").level).toBe("regular");
  });

  it("技能超過はフェイル", () => {
    expect(resolveCoCCheck(61, target, "7").level).toBe("fail");
    expect(resolveCoCCheck(95, target, "7").level).toBe("fail");
  });

  it("技能≥50 のファンブルは 100 のみ", () => {
    expect(resolveCoCCheck(100, target, "7").level).toBe("fumble");
    expect(resolveCoCCheck(96, target, "7").level).toBe("fail");
  });

  it("技能<50 のファンブルは 96–100", () => {
    expect(resolveCoCCheck(96, 40, "7").level).toBe("fumble");
    expect(resolveCoCCheck(100, 40, "7").level).toBe("fumble");
  });

  it("isSuccess は regular 以上で true", () => {
    expect(resolveCoCCheck(60, target, "7").isSuccess).toBe(true);
    expect(resolveCoCCheck(61, target, "7").isSuccess).toBe(false);
  });
});

describe("resolveCoCCheck — 6版", () => {
  const target = 50; // 1/5=10

  it("≤ 技能/5 はスペシャル", () => {
    expect(resolveCoCCheck(10, target, "6").level).toBe("special");
  });

  it("≤ 技能 はレギュラー", () => {
    expect(resolveCoCCheck(11, target, "6").level).toBe("regular");
    expect(resolveCoCCheck(50, target, "6").level).toBe("regular");
  });

  it("6版にハード/イクストリームは無い", () => {
    const r = resolveCoCCheck(25, target, "6");
    expect(r.level).toBe("regular");
  });

  it("技能<100 のファンブルは 96–100", () => {
    expect(resolveCoCCheck(96, target, "6").level).toBe("fumble");
    expect(resolveCoCCheck(100, target, "6").level).toBe("fumble");
  });

  it("不正な出目は例外", () => {
    expect(() => resolveCoCCheck(0, target, "6")).toThrow();
    expect(() => resolveCoCCheck(101, target, "6")).toThrow();
  });
});

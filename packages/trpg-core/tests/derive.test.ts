import { describe, it, expect } from "vitest";
import {
  computeCoCDerived,
  coc7DamageBonus,
  coc6DamageBonus,
  coc7BaseMov,
  movAgePenalty,
} from "../src/systems/coc/derive.js";

describe("coc7DamageBonus — STR+SIZ の境界", () => {
  const cases: [number, string, number][] = [
    [64, "-2", -2],
    [65, "-1", -1],
    [84, "-1", -1],
    [85, "0", 0],
    [124, "0", 0],
    [125, "+1D4", 1],
    [164, "+1D4", 1],
    [165, "+1D6", 2],
    [204, "+1D6", 2],
    [205, "+2D6", 3],
    [284, "+2D6", 3],
    [285, "+3D6", 4],
    [365, "+4D6", 5],
  ];
  it.each(cases)("STR+SIZ=%i → db %s / build %i", (sum, db, build) => {
    expect(coc7DamageBonus(sum)).toEqual({ db, build });
  });
});

describe("coc6DamageBonus — STR+SIZ の境界", () => {
  const cases: [number, string][] = [
    [12, "-1D6"],
    [13, "-1D4"],
    [16, "-1D4"],
    [17, "0"],
    [24, "0"],
    [25, "+1D4"],
    [33, "+1D6"],
    [41, "+2D6"],
    [56, "+2D6"],
    [57, "+3D6"],
  ];
  it.each(cases)("STR+SIZ=%i → %s", (sum, db) => {
    expect(coc6DamageBonus(sum)).toBe(db);
  });
});

describe("coc7BaseMov", () => {
  it("STR・DEX とも SIZ 未満 → 7", () => {
    expect(coc7BaseMov(40, 40, 80)).toBe(7);
  });
  it("STR・DEX とも SIZ 超過 → 9", () => {
    expect(coc7BaseMov(90, 90, 50)).toBe(9);
  });
  it("いずれか同値/混在 → 8", () => {
    expect(coc7BaseMov(50, 50, 50)).toBe(8);
    expect(coc7BaseMov(90, 40, 50)).toBe(8);
  });
});

describe("movAgePenalty", () => {
  it("40 歳未満は 0", () => {
    expect(movAgePenalty(undefined)).toBe(0);
    expect(movAgePenalty(39)).toBe(0);
  });
  it("40 代以降 10 歳ごとに -1(最大 -5)", () => {
    expect(movAgePenalty(40)).toBe(1);
    expect(movAgePenalty(55)).toBe(2);
    expect(movAgePenalty(90)).toBe(5);
    expect(movAgePenalty(120)).toBe(5);
  });
});

describe("computeCoCDerived — 7版", () => {
  it("代表値を算出する", () => {
    const d = computeCoCDerived("7", {
      STR: 50,
      CON: 60,
      SIZ: 50,
      DEX: 50,
      POW: 55,
    });
    expect(d.HP).toBe(Math.floor((60 + 50) / 10)); // 11
    expect(d.MP).toBe(Math.floor(55 / 5)); // 11
    expect(d.SAN).toBe(55);
    expect(d.DB).toBe("0"); // STR+SIZ=100
    expect(d.BUILD).toBe(0);
    expect(d.MOV).toBe(8); // STR=SIZ
  });
  it("年齢補正が MOV に乗る", () => {
    const d = computeCoCDerived(
      "7",
      { STR: 40, CON: 50, SIZ: 80, DEX: 40, POW: 50 },
      { age: 55 },
    );
    // base 7(とも SIZ 未満) - 2(55歳) = 5
    expect(d.MOV).toBe(5);
  });
});

describe("computeCoCDerived — 6版", () => {
  it("代表値を算出する", () => {
    const d = computeCoCDerived("6", {
      STR: 10,
      CON: 12,
      SIZ: 13,
      INT: 14,
      POW: 11,
      EDU: 16,
    });
    expect(d.HP).toBe(Math.round((12 + 13) / 2)); // 13(切り上げ)
    expect(d.MP).toBe(11);
    expect(d.SAN).toBe(55); // POW*5
    expect(d.IDEA).toBe(70); // INT*5
    expect(d.LUCK).toBe(55);
    expect(d.KNOW).toBe(80);
    expect(d.DB).toBe("0"); // STR+SIZ=23 → 17–24 帯 → ダメージボーナスなし
  });
});

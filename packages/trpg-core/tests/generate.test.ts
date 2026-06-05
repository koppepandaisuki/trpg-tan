import { describe, it, expect } from "vitest";
import {
  rollCharacteristicValue,
  generateAllCharacteristics,
} from "../src/systems/coc/generate.js";
import { coc7 } from "../src/systems/coc/coc7.js";
import { coc6 } from "../src/systems/coc/coc6.js";
import type { RandomFn } from "../src/dice/random.js";

function seqRandom(values: number[]): RandomFn {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("rollCharacteristicValue", () => {
  it("'3D6*5' を倍率込みで評価する(全て最小)", () => {
    // 3D6 すべて 1 → 3、×5 → 15
    expect(rollCharacteristicValue("3D6*5", seqRandom([0, 0, 0]))).toBe(15);
  });

  it("'(2D6+6)*5' を括弧・定数・倍率込みで評価する", () => {
    // 2D6 すべて 1 → 2、+6 → 8、×5 → 40
    expect(rollCharacteristicValue("(2D6+6)*5", seqRandom([0, 0]))).toBe(40);
  });

  it("倍率なし '3D6+3' をそのまま評価する", () => {
    // 3D6 すべて最大(6) → 18、+3 → 21
    expect(rollCharacteristicValue("3D6+3", seqRandom([0.999, 0.999, 0.999]))).toBe(
      21,
    );
  });

  it("不正な倍率は例外", () => {
    expect(() => rollCharacteristicValue("3D6*x")).toThrow();
  });
});

describe("generateAllCharacteristics", () => {
  it("7版: rollHint のある全能力値を生成する", () => {
    const chars = generateAllCharacteristics(coc7, seqRandom([0])); // 常に最小
    // 8 能力値すべて生成される
    expect(Object.keys(chars).sort()).toEqual(
      ["APP", "CON", "DEX", "EDU", "INT", "POW", "SIZ", "STR"].sort(),
    );
    // 3D6*5 の最小 = 15、(2D6+6)*5 の最小 = 40
    expect(chars.STR).toBe(15);
    expect(chars.SIZ).toBe(40);
  });

  it("6版: 素の能力値(×倍率なし)を生成する", () => {
    const chars = generateAllCharacteristics(coc6, seqRandom([0]));
    expect(chars.STR).toBe(3); // 3D6 最小
    expect(chars.SIZ).toBe(8); // 2D6+6 最小
    expect(chars.EDU).toBe(6); // 3D6+3 最小
  });
});

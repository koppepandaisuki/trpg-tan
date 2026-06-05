import { describe, it, expect } from "vitest";
import { parseDiceNotation, rollNotation } from "../src/dice/notation.js";
import type { RandomFn } from "../src/dice/random.js";

/**
 * rng をシーケンスで固定するヘルパー。値は [0,1) を返す想定で、
 * rollDie(sides) = floor(rng()*sides)+1 になる。
 * 例: sides=6 で出目 4 を出したいなら rng=0.5(floor(3)+1=4)。
 */
function seqRandom(values: number[]): RandomFn {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("parseDiceNotation", () => {
  it("単一ダイスを解析する", () => {
    expect(parseDiceNotation("1d100")).toEqual([
      { count: 1, sides: 100, sign: 1, constant: 0 },
    ]);
  });

  it("N 省略を 1 個として扱う", () => {
    expect(parseDiceNotation("d6")).toEqual([
      { count: 1, sides: 6, sign: 1, constant: 0 },
    ]);
  });

  it("複数項と定数の加減算を解析する", () => {
    expect(parseDiceNotation("2d6+1d4-1")).toEqual([
      { count: 2, sides: 6, sign: 1, constant: 0 },
      { count: 1, sides: 4, sign: 1, constant: 0 },
      { count: 0, sides: 0, sign: -1, constant: 1 },
    ]);
  });

  it("大文字 D と空白を許容する", () => {
    expect(parseDiceNotation(" 3 D 6 + 2 ")).toEqual([
      { count: 3, sides: 6, sign: 1, constant: 0 },
      { count: 0, sides: 0, sign: 1, constant: 2 },
    ]);
  });

  it("不正な記法は例外", () => {
    expect(() => parseDiceNotation("")).toThrow();
    expect(() => parseDiceNotation("abc")).toThrow();
    expect(() => parseDiceNotation("3d6 xyz")).toThrow();
  });
});

describe("rollNotation", () => {
  it("固定 rng で決定的な合計を返す", () => {
    // 3d6: 各 0.0 → 出目 1。合計 3。+2 で 5。
    const r = rollNotation("3d6+2", seqRandom([0, 0, 0]));
    expect(r.rolls).toEqual([1, 1, 1]);
    expect(r.total).toBe(5);
  });

  it("符号付き項を正しく減算する", () => {
    // 1d6(0.999→6) - 1d4(0→1) = 5
    const r = rollNotation("1d6-1d4", seqRandom([0.999, 0]));
    expect(r.rolls).toEqual([6, 1]);
    expect(r.total).toBe(5);
  });
});

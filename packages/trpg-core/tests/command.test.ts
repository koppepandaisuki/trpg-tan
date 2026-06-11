import { describe, it, expect } from "vitest";
import type { RandomFn } from "../src/dice/random.js";
import { parseDiceCommand, compareRoll } from "../src/dice/command.js";

function die(v: number, sides: number): number {
  return (v - 1) / sides + 1e-9;
}
function seqRng(values: number[]): RandomFn {
  let i = 0;
  return () => values[i++] ?? 0;
}

describe("parseDiceCommand", () => {
  it("空 / 普通の文は none(チャット)", () => {
    expect(parseDiceCommand("")).toEqual({ kind: "none" });
    expect(parseDiceCommand("こんにちは")).toEqual({ kind: "none" });
    expect(parseDiceCommand("12")).toEqual({ kind: "none" }); // 定数だけ
  });

  it("純粋な記法は notation", () => {
    expect(parseDiceCommand("2d6+1")).toEqual({
      kind: "notation",
      notation: "2d6+1",
      label: "2d6+1",
    });
    expect(parseDiceCommand("1d100 目星")).toEqual({
      kind: "notation",
      notation: "1d100",
      label: "目星",
    });
  });

  it("1d100<=N / CC / CCB は coc 判定", () => {
    expect(parseDiceCommand("1d100<=70")).toEqual({
      kind: "coc",
      target: 70,
      label: "1d100<=70",
    });
    expect(parseDiceCommand("1d100<=70 目星")).toMatchObject({
      kind: "coc",
      target: 70,
      label: "目星",
    });
    expect(parseDiceCommand("d100<=50")).toMatchObject({ kind: "coc", target: 50 });
    expect(parseDiceCommand("CC<=70")).toMatchObject({ kind: "coc", target: 70 });
    expect(parseDiceCommand("CCB<=70")).toMatchObject({ kind: "coc", target: 70 });
    expect(parseDiceCommand("CCB(70)")).toMatchObject({ kind: "coc", target: 70 });
    expect(parseDiceCommand("ccb70")).toMatchObject({ kind: "coc", target: 70 });
  });

  it("choice[a,b,c] は選択コマンド", () => {
    expect(parseDiceCommand("choice[赤,青,黄]")).toEqual({
      kind: "choice",
      options: ["赤", "青", "黄"],
      label: "choice[赤,青,黄]",
    });
    // 読点区切りも許容。選択肢 1 つは choice 扱いしない。
    expect(parseDiceCommand("choice[逃げる、戦う]")).toMatchObject({
      kind: "choice",
      options: ["逃げる", "戦う"],
    });
    expect(parseDiceCommand("choice[ひとつ]")).toEqual({ kind: "none" });
  });

  it("一般の比較は compare", () => {
    expect(parseDiceCommand("2d6>=8")).toEqual({
      kind: "compare",
      notation: "2d6",
      op: ">=",
      target: 8,
      label: "2d6>=8",
    });
    expect(parseDiceCommand("2d6>=8 ダメージ")).toMatchObject({
      kind: "compare",
      op: ">=",
      target: 8,
      label: "ダメージ",
    });
    // 1d100 でも <= 以外は compare 扱い
    expect(parseDiceCommand("1d100>50")).toMatchObject({
      kind: "compare",
      op: ">",
      target: 50,
    });
  });
});

describe("compareRoll", () => {
  it("成功/失敗を判定", () => {
    const ok = compareRoll("2d6", ">=", 8, seqRng([die(4, 6), die(5, 6)]));
    expect(ok.total).toBe(9);
    expect(ok.success).toBe(true);

    const ng = compareRoll("2d6", ">=", 10, seqRng([die(2, 6), die(3, 6)]));
    expect(ng.total).toBe(5);
    expect(ng.success).toBe(false);
  });
});

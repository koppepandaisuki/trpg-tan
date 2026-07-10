import { describe, expect, it } from "vitest";
import { runDiceBot, diceBotRollEvent } from "../src/index.js";

/** 決まった出目を順に返す擬似乱数(出目 v を返すには (v-1)/faces を入れる)。 */
function seq(faces: number, ...values: number[]) {
  let i = 0;
  return () => {
    const v = values[Math.min(i, values.length - 1)];
    i += 1;
    return (v - 1) / faces + 1e-9;
  };
}

describe("dicebot: sw25", () => {
  it("2d6+m>=t を判定し、出目66は自動成功", () => {
    const r = runDiceBot("sw25", "2d6+3>=20", seq(6, 6, 6))!;
    expect(r.dice).toEqual([6, 6]);
    expect(r.success).toBe(true);
    expect(r.detail).toContain("自動成功");
  });
  it("出目11は自動失敗", () => {
    const r = runDiceBot("sw25", "2d6+10>=3", seq(6, 1, 1))!;
    expect(r.success).toBe(false);
    expect(r.detail).toContain("自動失敗");
  });
  it("通常時は合計+修正と目標値で判定", () => {
    const r = runDiceBot("sw25", "2d6+2>=9", seq(6, 3, 4))!;
    expect(r.total).toBe(9);
    expect(r.success).toBe(true);
  });
  it("非該当コマンドは null(汎用へフォールバック)", () => {
    expect(runDiceBot("sw25", "1d100<=70", seq(6, 1))).toBeNull();
  });
});

describe("dicebot: shinobigami", () => {
  it("出目12はスペシャル", () => {
    const r = runDiceBot("shinobigami", "2d6>=10", seq(6, 6, 6))!;
    expect(r.success).toBe(true);
    expect(r.detail).toContain("スペシャル");
  });
  it("出目2はファンブル", () => {
    const r = runDiceBot("shinobigami", "2d6>=3", seq(6, 1, 1))!;
    expect(r.success).toBe(false);
    expect(r.detail).toContain("ファンブル");
  });
});

describe("dicebot: sf(サイコロ・フィクション汎用)", () => {
  it("出目12はスペシャル(中立文言)", () => {
    const r = runDiceBot("sf", "2d6>=10", seq(6, 6, 6))!;
    expect(r.success).toBe(true);
    expect(r.detail).toContain("スペシャル");
    expect(r.detail).not.toContain("生命力"); // シノビガミ固有文言は出ない
  });
  it("出目2はファンブル", () => {
    const r = runDiceBot("sf", "2d6>=3", seq(6, 1, 1))!;
    expect(r.success).toBe(false);
    expect(r.detail).toContain("ファンブル");
  });
  it("通常時は目標値との比較", () => {
    const r = runDiceBot("sf", "2d6>=7 判定", seq(6, 3, 4))!;
    expect(r.total).toBe(7);
    expect(r.success).toBe(true);
    expect(r.label).toBe("2d6>=7 判定");
  });
});

describe("dicebot: d20", () => {
  it("1d20+m>=t を判定する", () => {
    const r = runDiceBot("d20", "1d20+5>=15", seq(20, 10))!;
    expect(r.total).toBe(15);
    expect(r.success).toBe(true);
    expect(r.detail).toContain("成功");
  });
  it("出目20はクリティカルを告知(成否は比較のまま)", () => {
    const r = runDiceBot("d20", "1d20+2>=30", seq(20, 20))!;
    expect(r.detail).toContain("クリティカル");
    expect(r.success).toBe(false); // 22 < 30
  });
  it("出目1はファンブルを告知", () => {
    const r = runDiceBot("d20", "1d20+3>=2", seq(20, 1))!;
    expect(r.detail).toContain("ファンブル");
    expect(r.success).toBe(true); // 4 >= 2
  });
  it("目標値なし+ラベル付きでも動く", () => {
    const r = runDiceBot("d20", "1d20+4 隠密", seq(20, 7))!;
    expect(r.total).toBe(11);
    expect(r.label).toBe("1d20+4 隠密");
  });
  it("パラノイアの 1d20<=t とは競合しない(非該当は null)", () => {
    expect(runDiceBot("d20", "1d20<=8", seq(20, 5))).toBeNull();
  });
});

describe("dicebot: dx3", () => {
  it("クリティカルで振り足して達成値を計算(10 → 振り足し 7 = 17)", () => {
    const r = runDiceBot("dx3", "1DX@10", seq(10, 10, 7))!;
    expect(r.dice).toEqual([10, 7]);
    expect(r.total).toBe(17);
    expect(r.detail).toContain("クリティカル×1");
  });
  it("全部 1 はファンブル(達成値0)", () => {
    const r = runDiceBot("dx3", "2DX@10>=5", seq(10, 1, 1))!;
    expect(r.total).toBe(0);
    expect(r.success).toBe(false);
  });
});

describe("dicebot: emoklore", () => {
  it("成功数をカウント(能力値以下が成功 / 1=ダブル / 10=ファンブル)", () => {
    // 3DM<=4: 出目 [1, 4, 10] → 基本2(1,4) + クリ1 - ファンブル1 = 2
    const r = runDiceBot("emoklore", "3DM<=4", seq(10, 1, 4, 10))!;
    expect(r.total).toBe(2);
    expect(r.success).toBe(true);
    expect(r.detail).toContain("成功数2");
    expect(r.detail).toContain("クリティカル×1");
    expect(r.detail).toContain("ファンブル×1");
  });
});

describe("dicebot: nechronica / paranoia", () => {
  it("NC+1: 1d10+1 が 11 以上で大成功", () => {
    const r = runDiceBot("nechronica", "NC+1", seq(10, 10))!;
    expect(r.total).toBe(11);
    expect(r.detail).toContain("大成功");
  });
  it("paranoia: 出目20はファンブル", () => {
    const r = runDiceBot("paranoia", "1d20<=15", seq(20, 20))!;
    expect(r.success).toBe(false);
    expect(r.detail).toContain("反逆");
  });
});

describe("dicebot: 末尾ラベル付きでも判定が出る", () => {
  it("emoklore: 3DM<=4 観察眼 はラベルを保ったまま成功数を出す", () => {
    const r = runDiceBot("emoklore", "3DM<=4 観察眼", seq(10, 1, 4, 10))!;
    expect(r.total).toBe(2);
    expect(r.detail).toContain("成功数2");
    expect(r.label).toBe("3DM<=4 観察眼");
  });
  it("emoklore: 目標値なし 1DM 自我 もラベルを保つ", () => {
    const r = runDiceBot("emoklore", "1DM 〈自我〉", seq(10, 7))!;
    expect(r.label).toBe("1DM 〈自我〉");
  });
  it("sw25: 2d6+5>=10 命中 もラベル付きで判定", () => {
    const r = runDiceBot("sw25", "2d6+5>=10 命中", seq(6, 3, 4))!;
    expect(r.success).toBe(true);
    expect(r.label).toBe("2d6+5>=10 命中");
  });
  it("dx3: 1DX@10 全力 もラベル付き", () => {
    const r = runDiceBot("dx3", "1DX@10 全力", seq(10, 10, 7))!;
    expect(r.total).toBe(17);
    expect(r.label).toBe("1DX@10 全力");
  });
  it("paranoia: 1d20<=8 尋問 もラベル付き", () => {
    const r = runDiceBot("paranoia", "1d20<=8 尋問", seq(20, 5))!;
    expect(r.success).toBe(true);
    expect(r.label).toBe("1d20<=8 尋問");
  });
});

describe("diceBotRollEvent", () => {
  it("RollEvent として刻まれる(notation/detail 付き)", () => {
    const ev = diceBotRollEvent(
      { id: "e1", ts: "2026-01-01T00:00:00Z", rng: seq(6, 6, 6) },
      "忍",
      "2d6>=5",
      "shinobigami",
    )!;
    expect(ev.kind).toBe("roll");
    expect(ev.notation).toBe("2d6");
    expect(ev.detail).toContain("スペシャル");
  });
  it("非該当は null", () => {
    const ev = diceBotRollEvent(
      { id: "e2", ts: "2026-01-01T00:00:00Z" },
      "誰か",
      "こんにちは",
      "sw25",
    );
    expect(ev).toBeNull();
  });
});

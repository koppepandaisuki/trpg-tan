import { describe, it, expect } from "vitest";
import { externalRollEvent, totalFromResultText } from "../src/play/index.js";

/** BCDice 等の外部ダイスエンジンの結果 → ロールイベント。 */
describe("externalRollEvent", () => {
  const ctx = { id: "e1", ts: "2026-10-14T00:00:00.000Z" };

  it("成否・出目・合計・詳細を移す", () => {
    const ev = externalRollEvent(ctx, "アリス", {
      command: "2D6+3>=10",
      text: "(2D6+3>=10) ＞ 6[5,1]+3 ＞ 9 ＞ 失敗",
      rands: [[5, 6], [1, 6]],
      success: false,
      failure: true,
      critical: false,
      fumble: false,
      secret: false,
    });
    expect(ev).toMatchObject({
      kind: "roll",
      actor: "アリス",
      label: "2D6+3>=10",
      dice: [5, 1],
      total: 9,
      success: false,
      detail: "6[5,1]+3 ＞ 9 ＞ 失敗",
    });
    expect(ev.secret).toBeUndefined();
  });

  it("シークレットは GM だけに見せる形にし、クリティカルを添える", () => {
    const ev = externalRollEvent(ctx, "GM", {
      command: "SK20",
      text: "KeyNo.20c[10] ＞ 2D:[6,6 6,1]=12,7 ＞ 10,5 ＞ 1回転 ＞ 15",
      rands: [[6, 6], [6, 6], [6, 6], [1, 6]],
      success: false,
      failure: false,
      critical: true,
      fumble: false,
      secret: true,
    });
    expect(ev.secret).toBe(true);
    expect(ev.visibleTo).toEqual([]);
    expect(ev.total).toBe(15);
    expect(ev.detail).toContain("クリティカル");
    expect(ev.success).toBeUndefined();
  });

  it("合計が書かれていない結果は出目の和", () => {
    expect(totalFromResultText("(choice[A,B]) ＞ B", [[2, 2]])).toBe(2);
  });
});

import { describe, it, expect } from "vitest";
import { createScene, makeTokenPanel, type PlayScene } from "@trpg/core";
import { resolveInputToEvent } from "@/lib/play/roll";

/**
 * Web 版 PLAY の入力解釈が、デスクトップ版(PlayTable.handleSend)と
 * 同じ順序・同じ結果になることのテスト。
 * 「発言かダイスか」「どのダイスルールで振るか」を取り違えると卓が壊れるので、
 * 分岐ごとに固定する。
 */

const ctx = { id: "ev-1", ts: "2026-07-30T00:00:00.000Z" };

function sceneWith(panels: PlayScene["panels"] = []): PlayScene {
  return {
    ...createScene({ id: "s1", title: "テスト卓", now: ctx.ts }),
    panels,
  };
}

describe("resolveInputToEvent", () => {
  it("ダイスコマンドでない入力は普通の発言になる", () => {
    const ev = resolveInputToEvent({
      ctx,
      scene: sceneWith(),
      speakerId: "GM",
      raw: "こんばんは、探索者たち",
    });
    expect(ev?.kind).toBe("chat");
    if (ev?.kind === "chat") {
      expect(ev.text).toBe("こんばんは、探索者たち");
      expect(ev.actor).toBe("GM");
    }
  });

  it("空入力は何も起こさない", () => {
    expect(
      resolveInputToEvent({
        ctx,
        scene: sceneWith(),
        speakerId: "GM",
        raw: "   ",
      }),
    ).toBeNull();
  });

  it("CC<=70 は CoC 判定になり成功度が付く", () => {
    const ev = resolveInputToEvent({
      ctx,
      scene: sceneWith(),
      speakerId: "GM",
      raw: "CC<=70 目星",
    });
    expect(ev?.kind).toBe("roll");
    if (ev?.kind === "roll") {
      expect(ev.check).toBeDefined();
      expect(ev.check?.target).toBe(70);
      expect(ev.dice).toHaveLength(1);
      expect(ev.dice[0]).toBeGreaterThanOrEqual(1);
      expect(ev.dice[0]).toBeLessThanOrEqual(100);
    }
  });

  it("卓が CoC6 なら 6 版の判定になる(版は systemId から解決)", () => {
    const scene: PlayScene = { ...sceneWith(), systemId: "coc6" };
    const ev = resolveInputToEvent({
      ctx,
      scene,
      speakerId: "GM",
      raw: "CC<=50",
    });
    if (ev?.kind === "roll") expect(ev.check?.edition).toBe("6");
  });

  it("2d6 はフリーダイスになる", () => {
    const ev = resolveInputToEvent({
      ctx,
      scene: sceneWith(),
      speakerId: "GM",
      raw: "2d6",
    });
    expect(ev?.kind).toBe("roll");
    if (ev?.kind === "roll") {
      expect(ev.dice).toHaveLength(2);
      expect(ev.check).toBeUndefined();
      expect(ev.total).toBeGreaterThanOrEqual(2);
      expect(ev.total).toBeLessThanOrEqual(12);
    }
  });

  it("2d6>=8 は比較ロールになり成否が付く", () => {
    const ev = resolveInputToEvent({
      ctx,
      scene: sceneWith(),
      speakerId: "GM",
      raw: "2d6>=8 回避",
    });
    expect(ev?.kind).toBe("roll");
    if (ev?.kind === "roll") {
      expect(ev.compare).toEqual({ op: ">=", target: 8 });
      expect(typeof ev.success).toBe("boolean");
    }
  });

  it("choice[…] は選択肢から 1 つ選ぶ", () => {
    const ev = resolveInputToEvent({
      ctx,
      scene: sceneWith(),
      speakerId: "GM",
      raw: "choice[北,南,東]",
    });
    expect(ev?.kind).toBe("roll");
    if (ev?.kind === "roll") {
      expect(ev.label).toMatch(/^choice → (北|南|東)$/);
    }
  });

  it("駒が発言者なら駒の名前で記録される", () => {
    const panel = makeTokenPanel({ id: "p1", name: "探索者A" });
    const ev = resolveInputToEvent({
      ctx,
      scene: sceneWith([panel]),
      speakerId: "p1",
      raw: "やあ",
    });
    expect(ev?.actor).toBe("探索者A");
  });

  it("as 指定は駒より優先される(参加者が自分の名前で喋る)", () => {
    const ev = resolveInputToEvent({
      ctx,
      scene: sceneWith(),
      speakerId: "GM",
      as: "たろう",
      raw: "よろしく",
    });
    expect(ev?.actor).toBe("たろう");
  });

  it("駒のダイスボットが卓より優先される(混在システム卓)", () => {
    // エモクロアの XDM<=t は専用ボットでのみ解釈される。
    const panel = {
      ...makeTokenPanel({ id: "p1", name: "エモ" }),
      diceBot: "emoklore",
    };
    const ev = resolveInputToEvent({
      ctx,
      scene: sceneWith([panel]),
      speakerId: "p1",
      raw: "2DM<=4 調査",
    });
    expect(ev?.kind).toBe("roll");
    if (ev?.kind === "roll") {
      expect(ev.dice).toHaveLength(2); // 2 個振る
      expect(ev.detail).toContain("成功数"); // 成功数カウント
    }
  });

  it("シークレット指定はダイスにだけ付く(発言には付かない)", () => {
    const roll = resolveInputToEvent({
      ctx,
      scene: sceneWith(),
      speakerId: "GM",
      raw: "1d100",
      secret: true,
      visibleTo: ["p1"],
    });
    if (roll?.kind === "roll") {
      expect(roll.secret).toBe(true);
      expect(roll.visibleTo).toEqual(["p1"]);
    }
    const chat = resolveInputToEvent({
      ctx,
      scene: sceneWith(),
      speakerId: "GM",
      raw: "ただの発言",
      secret: true,
    });
    expect(chat?.kind).toBe("chat");
    expect("secret" in (chat ?? {})).toBe(false);
  });

  it("チャパレ変数が駒のデータで置換される", () => {
    const panel = {
      ...makeTokenPanel({ id: "p1", name: "探索者A" }),
      stats: [
        {
          key: "spot",
          label: "目星",
          value: 70,
          target: 70,
          kind: "skill" as const,
        },
      ],
    };
    const ev = resolveInputToEvent({
      ctx,
      scene: sceneWith([panel]),
      speakerId: "p1",
      raw: "CC<={目星} 目星",
    });
    expect(ev?.kind).toBe("roll");
    if (ev?.kind === "roll") expect(ev.check?.target).toBe(70);
  });
});

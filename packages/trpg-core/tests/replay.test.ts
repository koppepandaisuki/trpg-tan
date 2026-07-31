import { describe, it, expect } from "vitest";
import { replayToText, replayToHtml, type PlayEvent } from "../src/index.js";

/**
 * リプレイ書き出し。デスクトップと Web が同じ関数を共有するようになったので、
 * 「秘匿の伏せ」と「HTML 注入されない」ことをここで固定する。
 */

const TS = "2026-08-01T12:34:56.000Z";

function chat(text: string, extra: Partial<PlayEvent> = {}): PlayEvent {
  return {
    id: "c1",
    ts: TS,
    kind: "chat",
    actor: "探索者A",
    text,
    ...extra,
  } as PlayEvent;
}

function roll(extra: Record<string, unknown> = {}): PlayEvent {
  return {
    id: "r1",
    ts: TS,
    kind: "roll",
    actor: "探索者A",
    label: "目星",
    dice: [42],
    total: 42,
    ...extra,
  } as PlayEvent;
}

const nameOf = (id?: string) => (id ? `#${id}` : "メイン");

describe("replayToText", () => {
  it("チャットを [時刻][チャンネル] 名前: 本文 で書き出す", () => {
    const out = replayToText([chat("こんにちは")], nameOf);
    expect(out).toContain("[メイン] 探索者A: こんにちは");
  });

  it("ダイスは出目と合計、判定結果まで書き出す", () => {
    const out = replayToText(
      [roll({ check: { isSuccess: true, level: "hard" } })],
      nameOf,
    );
    expect(out).toContain("🎲 目星 [42] = 42");
    expect(out).toContain("成功(hard)");
  });

  it("canSee 未指定(GM 相当)なら秘匿ロールも出目を書き出す", () => {
    const out = replayToText([roll({ secret: true, visibleTo: [] })], nameOf);
    expect(out).toContain("[42] = 42");
    expect(out).toContain("（シークレット）");
  });

  it("canSee が false の秘匿ロールは出目を伏せる", () => {
    const out = replayToText(
      [roll({ secret: true, visibleTo: ["p9"] })],
      nameOf,
      () => false,
    );
    expect(out).not.toContain("42");
    expect(out).toContain("シークレット・非公開");
  });

  it("canSee が true なら秘匿ロールでも出目が出る", () => {
    const out = replayToText(
      [roll({ secret: true, visibleTo: ["p1"] })],
      nameOf,
      (ev) => (ev.visibleTo ?? []).includes("p1"),
    );
    expect(out).toContain("[42] = 42");
  });

  it("system / resource もログに含む", () => {
    const log: PlayEvent[] = [
      { id: "s1", ts: TS, kind: "system", text: "セッション開始" } as PlayEvent,
      {
        id: "e1",
        ts: TS,
        kind: "resource",
        actor: "探索者A",
        label: "HP",
        delta: -3,
        current: 7,
      } as PlayEvent,
    ];
    const out = replayToText(log, nameOf);
    expect(out).toContain("セッション開始");
    expect(out).toContain("HP -3 → 7");
  });
});

describe("replayToHtml", () => {
  it("単体で開ける HTML を返す", () => {
    const html = replayToHtml([chat("やあ")], nameOf, "白嶺の裁");
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<title>白嶺の裁 — リプレイ</title>");
    expect(html).toContain("やあ");
  });

  it("発言本文の HTML をエスケープする(注入防止)", () => {
    const html = replayToHtml(
      [chat("<script>alert(1)</script>")],
      nameOf,
      "卓",
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("発言者色はホワイトリスト外を捨てる", () => {
    const ok = replayToHtml([chat("赤", { color: "#B02832" })], nameOf, "卓");
    expect(ok).toContain("color:#B02832");

    const ng = replayToHtml(
      [chat("悪", { color: 'red;background:url("javascript:1")' })],
      nameOf,
      "卓",
    );
    expect(ng).not.toContain("javascript:");
    expect(ng).not.toContain("style=");
  });
});

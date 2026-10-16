import { describe, it, expect } from "vitest";
import {
  createScene,
  reduce,
  chatEvent,
  parsePlayFile,
  serializePlayFile,
  clonePlayScene,
  playFileName,
  PlayFileError,
  type PlayScene,
} from "../src/play/index.js";

const NOW = "2026-10-14T00:00:00.000Z";

function sample(): PlayScene {
  let s = createScene({ id: "t1", title: "白嶺の館/第1話", systemId: "coc6", now: NOW });
  s = reduce(s, chatEvent({ id: "e1", ts: NOW }, "GM", "はじめます"));
  return { ...s, turn: { round: 2, activePanelId: null } };
}

describe("parsePlayFile / serializePlayFile", () => {
  it("書き出したものを読み戻せる", () => {
    const s = sample();
    expect(parsePlayFile(serializePlayFile(s))).toEqual(s);
  });
  it("シーンの無い古い卓はシーン1を補う", () => {
    const { scenes: _s, activeSceneId: _a, ...old } = sample();
    const p = parsePlayFile(JSON.stringify(old));
    expect(p.scenes).toHaveLength(1);
    expect(p.activeSceneId).toBe("t1::s1");
  });
  it("卓ファイルでないものは分かる言葉で断る", () => {
    expect(() => parsePlayFile("not json")).toThrow(PlayFileError);
    expect(() => parsePlayFile(JSON.stringify({ id: "x" }))).toThrow(/版/);
    expect(() =>
      parsePlayFile(JSON.stringify({ ...sample(), panels: "x" })),
    ).toThrow(/壊れて/);
  });
});

describe("clonePlayScene", () => {
  it("新しい id で、ログとターンを消して複製する", () => {
    const c = clonePlayScene(sample(), { id: "t2", now: "2026-10-15T00:00:00.000Z" });
    expect(c.id).toBe("t2");
    expect(c.title).toBe("白嶺の館/第1話(コピー)");
    expect(c.log).toEqual([]);
    expect(c.turn).toBeUndefined();
    expect(c.meta.createdAt).toBe("2026-10-15T00:00:00.000Z");
  });
  it("keepLog でログを残す", () => {
    expect(clonePlayScene(sample(), { id: "t2", now: NOW, keepLog: true }).log).toHaveLength(1);
  });
});

describe("playFileName", () => {
  it("ファイル名に使えない文字を置き換える", () => {
    expect(playFileName(sample())).toBe("白嶺の館_第1話.play");
  });
});

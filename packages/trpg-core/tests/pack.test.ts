import { describe, it, expect } from "vitest";
import { createScene } from "../src/play/reduce.js";
import { newGenericSheet, type SystemDef } from "../src/system-builder/types.js";
import {
  PACK_FORMAT,
  buildPack,
  serializePack,
  parsePack,
  collectPackMediaUrls,
} from "../src/pack/index.js";

const sys: SystemDef = {
  id: "sys-1",
  name: "テストシステム",
  attributes: [{ key: "str", label: "筋力", initial: 10 }],
  skills: [{ label: "目星", initial: 25 }],
  resources: [{ key: "hp", label: "HP", max: 10 }],
};

function scene() {
  const s = createScene({ id: "sc-1", title: "シナリオ1", now: "2026-01-01T00:00:00Z" });
  return { ...s, board: { image: "https://cdn.example.com/play/abc.png", grid: true } };
}

describe("pack", () => {
  it("組み立て → 直列化 → 復元で往復できる", () => {
    const pack = buildPack({ id: "p1", name: "My Game", system: sys, scenarios: [scene()] });
    expect(pack.format).toBe(PACK_FORMAT);
    const r = parsePack(serializePack(pack));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.pack.name).toBe("My Game");
      expect(r.pack.scenarios?.length).toBe(1);
      expect(r.pack.system?.id).toBe("sys-1");
    }
  });

  it("未対応フォーマット / 壊れた JSON を拒否する", () => {
    expect(parsePack(JSON.stringify({ format: "nope", id: "x", name: "y", version: "1" })).ok).toBe(false);
    expect(parsePack("{壊れた").ok).toBe(false);
    expect(parsePack(buildPack({ id: "", name: "n" })).ok).toBe(false); // id 空
  });

  it("シナリオ/シートの版が不一致なら拒否する", () => {
    const badScene = { ...scene(), schemaVersion: 999 };
    const pack = { ...buildPack({ id: "p", name: "n" }), scenarios: [badScene] };
    expect(parsePack(pack).ok).toBe(false);

    const sheet = newGenericSheet(sys, "sheet-1");
    expect(parsePack(buildPack({ id: "p", name: "n", sheets: [sheet] })).ok).toBe(true);
  });

  it("http(s) メディア URL だけを集める(data URL は集めない)", () => {
    const sc = {
      ...scene(),
      cutins: [{ id: "c1", name: "x", image: "https://cdn.example.com/play/c.png" }],
      panels: [
        {
          id: "pp",
          source: "token",
          name: "n",
          color: "#fff",
          stats: [],
          resources: [],
          portrait: "data:image/png;base64,AAA",
        },
      ],
    };
    const pack = buildPack({
      id: "p",
      name: "n",
      scenarios: [sc as never],
      media: [{ url: "https://cdn.example.com/play/m.mp3", mime: "audio/mpeg" }],
    });
    const urls = collectPackMediaUrls(pack);
    expect(urls).toContain("https://cdn.example.com/play/abc.png");
    expect(urls).toContain("https://cdn.example.com/play/c.png");
    expect(urls).toContain("https://cdn.example.com/play/m.mp3");
    expect(urls.some((u) => u.startsWith("data:"))).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { parseCcfoliaCharacter } from "../src/play/ccfolia.js";

let n = 0;
const makeId = () => `id-${++n}`;

describe("parseCcfoliaCharacter", () => {
  it("ココフォリア駒 JSON を Panel に変換する", () => {
    const json = JSON.stringify({
      kind: "character",
      data: {
        name: "探索者A",
        memo: "職業: 探偵",
        initiative: 11,
        iconUrl: "https://cdn.example.com/icon.png",
        color: "#abcdef",
        status: [
          { label: "HP", value: 12, max: 12 },
          { label: "MP", value: 8, max: 8 },
          { label: "SAN", value: 50, max: 99 },
        ],
        params: [
          { label: "STR", value: "13" },
          { label: "DEX", value: "11" },
        ],
        commands: "1d100<=60 【目星】\n1d100<=50 【聞き耳】",
      },
    });
    const p = parseCcfoliaCharacter(json, makeId);
    expect(p).not.toBeNull();
    if (!p) return;
    expect(p.name).toBe("探索者A");
    expect(p.source).toBe("token");
    expect(p.portrait).toBe("https://cdn.example.com/icon.png");
    expect(p.color).toBe("#abcdef");
    expect(p.note).toBe("職業: 探偵");
    expect(p.speed).toBe(11);
    expect(p.palette).toContain("目星");
    expect(p.resources).toHaveLength(3);
    expect(p.resources[0]).toMatchObject({
      key: "hp",
      label: "HP",
      current: 12,
      max: 12,
    });
    expect(p.stats).toHaveLength(2);
    expect(p.stats[0]).toMatchObject({ label: "STR", value: 13, target: 13 });
  });

  it("max 欠落の status は value を max に流用する", () => {
    const p = parseCcfoliaCharacter(
      { kind: "character", data: { name: "x", status: [{ label: "HP", value: 7 }] } },
      makeId,
    );
    expect(p?.resources[0]).toMatchObject({ current: 7, max: 7 });
  });

  it("ココフォリア駒でない / 壊れた入力は null", () => {
    expect(parseCcfoliaCharacter("{壊れた", makeId)).toBeNull();
    expect(parseCcfoliaCharacter(JSON.stringify({ kind: "memo" }), makeId)).toBeNull();
    expect(parseCcfoliaCharacter(JSON.stringify({ kind: "character" }), makeId)).toBeNull();
    expect(parseCcfoliaCharacter("just text", makeId)).toBeNull();
  });

  it("名前空・status/params 無しでも最低限の Panel を作る", () => {
    const p = parseCcfoliaCharacter({ kind: "character", data: {} }, makeId);
    expect(p).not.toBeNull();
    expect(p?.name).toBe("コマ");
    expect(p?.resources).toEqual([]);
    expect(p?.stats).toEqual([]);
    expect(p?.portrait).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import { genericSheetFromCcfolia } from "../src/system-builder/ccfolia-sheet.js";

describe("genericSheetFromCcfolia", () => {
  it("ココフォリア駒 JSON を GenericSheet に変換する", () => {
    const json = JSON.stringify({
      kind: "character",
      data: {
        name: "探索者A",
        memo: "職業: 探偵",
        iconUrl: "https://cdn.example.com/icon.png",
        status: [
          { label: "HP", value: 12, max: 12 },
          { label: "SAN", value: 50, max: 99 },
        ],
        params: [
          { label: "STR", value: "13" },
          { label: "DEX", value: "11" },
        ],
        commands: "1d100<=60 【目星】\n1d100<=50 【聞き耳】",
      },
    });
    const s = genericSheetFromCcfolia(json, "sheet-1");
    expect(s).not.toBeNull();
    if (!s) return;
    expect(s.kind).toBe("generic");
    expect(s.id).toBe("sheet-1");
    expect(s.systemId).toBe("ccfolia-import");
    expect(s.name).toBe("探索者A");
    expect(s.image).toBe("https://cdn.example.com/icon.png");
    expect(s.memo).toBe("職業: 探偵");
    expect(s.palette).toContain("目星");
    expect(s.resources).toHaveLength(2);
    expect(s.resources[0]).toMatchObject({
      key: "hp",
      label: "HP",
      current: 12,
      max: 12,
    });
    expect(s.attributes).toHaveLength(2);
    expect(s.attributes[0]).toMatchObject({ label: "STR", value: 13 });
    expect(s.skills).toEqual([]);
  });

  it("名前未設定はプレースホルダにせず空にする(エディタで入力を促す)", () => {
    const s = genericSheetFromCcfolia({ kind: "character", data: {} }, "s2");
    expect(s).not.toBeNull();
    expect(s?.name).toBe("");
  });

  it("ココフォリア駒でない入力は null", () => {
    expect(genericSheetFromCcfolia("ただのテキスト", "s3")).toBeNull();
    expect(
      genericSheetFromCcfolia(JSON.stringify({ kind: "memo" }), "s4"),
    ).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  SYSTEM_PRESETS,
  newGenericSheet,
  panelFromGeneric,
  renderPaletteTemplate,
} from "../src/index.js";

describe("system presets", () => {
  it("13 システム分のプリセットがあり、id が一意", () => {
    expect(SYSTEM_PRESETS.length).toBe(13);
    const ids = new Set(SYSTEM_PRESETS.map((s) => s.id));
    expect(ids.size).toBe(13);
  });

  it("diceBot 指定は実在するボット id を指す", () => {
    // 存在しない id を書いても実行時は汎用へフォールバックして
    // 気づきにくいので、プリセット追加時にここで固定する。
    const known = new Set([
      "generic",
      "coc",
      "sw25",
      "dx3",
      "shinobigami",
      "sf",
      "emoklore",
      "nechronica",
      "paranoia",
      "d20",
    ]);
    for (const s of SYSTEM_PRESETS) {
      if (s.diceBot) expect(known.has(s.diceBot), `${s.id}: ${s.diceBot}`).toBe(true);
    }
  });

  it("checkTemplate は {value} を含む(設定されている場合)", () => {
    for (const s of SYSTEM_PRESETS) {
      if (s.checkTemplate && s.checkTemplate.includes("{")) {
        expect(s.checkTemplate).toContain("{value}");
      }
    }
  });
});

describe("newGenericSheet / renderPaletteTemplate", () => {
  const sw = SYSTEM_PRESETS.find((s) => s.id === "preset-sw25")!;

  it("システム定義から初期シートを作る", () => {
    const sheet = newGenericSheet(sw, "c1");
    expect(sheet.kind).toBe("generic");
    expect(sheet.systemName).toBe("ソード・ワールド2.5");
    expect(sheet.attributes.length).toBe(sw.attributes.length);
    expect(sheet.resources[0].current).toBe(sheet.resources[0].max);
  });

  it("パレットの {ラベル} がキャラの値に置換される", () => {
    const sheet = newGenericSheet(sw, "c2");
    sheet.attributes = sheet.attributes.map((a) =>
      a.label === "敏捷度B" ? { ...a, value: 3 } : a,
    );
    const text = renderPaletteTemplate(
      ["2d6+{敏捷度B}>=? 回避", "{未知}d6 そのまま"],
      sheet,
    );
    expect(text).toContain("2d6+3>=? 回避");
    expect(text).toContain("{未知}d6 そのまま");
  });
});

describe("panelFromGeneric", () => {
  it("能力値/技能/リソース/判定雛形が駒へ写る", () => {
    const def = SYSTEM_PRESETS.find((s) => s.id === "preset-paranoia")!;
    const sheet = newGenericSheet(def, "c3");
    sheet.name = "トラブルシューター";
    const panel = panelFromGeneric({ id: "p1", sheet });
    expect(panel.name).toBe("トラブルシューター");
    expect(panel.systemName).toBe("パラノイア");
    expect(panel.checkTemplate).toBe("1d20<={value}");
    expect(panel.stats.some((s) => s.label === "暴力" && s.target === 8)).toBe(
      true,
    );
    expect(panel.resources.some((r) => r.label === "クローン残機")).toBe(true);
  });
});

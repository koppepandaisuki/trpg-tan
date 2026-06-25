import { describe, it, expect } from "vitest";
import { panelVariables, substituteVars } from "../src/play/vars.js";
import type { Panel } from "../src/play/types.js";

const panel: Panel = {
  id: "p1",
  source: "sheet",
  name: "取宗肉男",
  color: "#888",
  stats: [
    { key: "BODY", label: "BODY", value: 2, target: 2, kind: "characteristic" },
    { key: "spot", label: "観察眼", value: 1, target: 1, kind: "skill" },
    { key: "strength", label: "強度", value: 3, target: 3, kind: "derived" },
  ],
  resources: [
    { key: "hp", label: "HP", current: 16, max: 16 },
    { key: "resonance", label: "共鳴", current: 1, max: 1 },
  ],
};

describe("panelVariables", () => {
  it("能力値/技能/リソースをラベルで引ける", () => {
    const v = panelVariables(panel);
    expect(v["BODY"]).toBe(2);
    expect(v["観察眼"]).toBe(1);
    expect(v["強度"]).toBe(3);
    expect(v["HP"]).toBe(16);
    expect(v["共鳴"]).toBe(1);
    expect(v["HP_max"]).toBe(16);
  });
});

describe("substituteVars", () => {
  const vars = { 共鳴: 1, 強度: 3, HP: 16 };

  it("{} と [] の両方を置換する", () => {
    expect(substituteVars("{共鳴}DM<=[強度]", vars)).toBe("1DM<=3");
  });

  it("前後の空白を無視する", () => {
    expect(substituteVars("{ 共鳴 }", vars)).toBe("1");
  });

  it("未解決の参照はそのまま残す", () => {
    expect(substituteVars("{未定義}+1", vars)).toBe("{未定義}+1");
  });

  it("実際のキャラデータで判定式が組める", () => {
    const out = substituteVars("{共鳴}DM<=[強度] ルーツ", panelVariables(panel));
    expect(out).toBe("1DM<=3 ルーツ");
  });
});

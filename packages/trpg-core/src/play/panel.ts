import type { CharacterSheet } from "../character/types.js";
import { getSystem } from "../systems/index.js";
import { computeCoCDerived } from "../systems/coc/derive.js";
import type { CoCEdition } from "../dice/coc-check.js";
import type { Panel, PanelResource, PanelStat } from "./types.js";

/**
 * パネル(キャラ駒)の生成。.ccsheet からのスナップショット取込と、
 * キャラシ無しの自由トークン。いずれも純粋関数(id/color は呼び出し側が与える)。
 */

/** 卓パネルのアクセント色。id から決定的に選ぶ。 */
const PALETTE = [
  "#37ace8",
  "#7de4d3",
  "#f4c94a",
  "#f08c6b",
  "#a78bfa",
  "#4ade80",
  "#fb7185",
  "#38bdf8",
];

export function panelColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

/**
 * .ccsheet から駒を作る。能力値は版に応じた判定目標値に変換し、技能は
 * シートに記録された(割り振り済みの)もののみ判定ボタンにする。HP/SAN/MP は
 * 派生値計算から初期リソースにする。元シートは変更しない。
 */
export function panelFromSheet(params: {
  id: string;
  sheet: CharacterSheet;
  color?: string;
}): Panel {
  const { id, sheet } = params;
  const sys = getSystem(sheet.systemId);
  const edition: CoCEdition = sys?.edition ?? "7";
  const chars = sheet.characteristics ?? {};

  const stats: PanelStat[] = [];

  // 能力値: 7版=値そのまま / 6版=値×5 を目標値に。
  if (sys) {
    for (const c of sys.characteristics) {
      const value = chars[c.key] ?? 0;
      const target = edition === "7" ? value : value * 5;
      stats.push({ key: c.key, label: c.label, value, target, kind: "characteristic" });
    }
  }

  // 技能: シートに記録済みのものだけ(目標値=値)。ラベルはシステム定義から。
  const skillLabel = new Map<string, string>(
    (sys?.skills ?? []).map((s) => [s.key, s.label]),
  );
  for (const [key, value] of Object.entries(sheet.skills ?? {})) {
    if (typeof value !== "number") continue;
    stats.push({
      key,
      label: skillLabel.get(key) ?? key,
      value,
      target: value,
      kind: "skill",
    });
  }

  // リソース: HP/MP/SAN(数値のものだけ)。
  const resources: PanelResource[] = [];
  if (sys) {
    const d = computeCoCDerived(edition, chars);
    const push = (key: string, label: string, max?: number) => {
      const v = d[key];
      if (typeof v === "number") {
        resources.push({ key: key.toLowerCase(), label, current: v, max: max ?? v });
      }
    };
    push("HP", "HP");
    push("MP", "MP");
    push("SAN", "SAN", 99); // 上限は概ね 99(神話技能で逓減)
  }

  return {
    id,
    source: "sheet",
    name: sheet.name || "(名称未設定)",
    portrait: sheet.image ?? null,
    color: params.color ?? panelColor(id),
    systemId: sheet.systemId,
    edition,
    sheetId: sheet.id,
    stats,
    resources,
    // 行動順(速さ)。CoC は DEX で初期化(後から卓上で変更可)。
    ...(typeof chars.DEX === "number" ? { speed: chars.DEX } : {}),
  };
}

/** キャラシ無しの自由トークン(NPC/敵)。任意で HP を持てる。 */
export function makeTokenPanel(params: {
  id: string;
  name: string;
  color?: string;
  hp?: number;
  portrait?: string | null;
}): Panel {
  const resources: PanelResource[] =
    typeof params.hp === "number"
      ? [{ key: "hp", label: "HP", current: params.hp, max: params.hp }]
      : [];
  return {
    id: params.id,
    source: "token",
    name: params.name || "トークン",
    portrait: params.portrait ?? null,
    color: params.color ?? panelColor(params.id),
    stats: [],
    resources,
  };
}

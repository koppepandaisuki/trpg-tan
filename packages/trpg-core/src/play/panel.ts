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
  // オリジナル技能(custom_<uuid>)はシステム定義に無いのでシート側のラベルで
  // 補い、専門化技能は〈専門名〉を付ける(運転〈自動車〉)。これがチャパレ取り込み
  // と判定ボタン・コマンドにそのまま反映される。
  const skillLabel = new Map<string, string>(
    (sys?.skills ?? []).map((s) => [s.key, s.label]),
  );
  for (const c of sheet.customSkills ?? []) skillLabel.set(c.key, c.label);
  const specialties = sheet.skillSpecialties ?? {};
  for (const [key, value] of Object.entries(sheet.skills ?? {})) {
    if (typeof value !== "number") continue;
    const base = skillLabel.get(key) ?? key;
    const spec = specialties[key]?.trim();
    stats.push({
      key,
      label: spec ? `${base}〈${spec}〉` : base,
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

  // 情報/メモ: キャラシの職業・メモ・背景を駒に引き継ぐ(卓上から参照できる)。
  const occupationName =
    sheet.occupationName?.trim() ||
    (sheet.occupationId
      ? sys?.occupations.find((o) => o.id === sheet.occupationId)?.name
      : undefined);
  const noteBits: string[] = [];
  if (occupationName) noteBits.push(`職業: ${occupationName}`);
  if (sheet.notes?.trim()) noteBits.push(`【メモ】\n${sheet.notes.trim()}`);
  if (sheet.backstory?.trim()) noteBits.push(`【背景】\n${sheet.backstory.trim()}`);

  // チャットパレット: シートの技能・能力値から最初から使える形で生成する。
  // SAN チェックは {SAN} 変数参照(送信時に現在値へ置換)なので減っても正しい。
  const paletteLines: string[] = [];
  const skillStats = stats.filter((s) => s.kind === "skill");
  if (skillStats.length > 0) {
    paletteLines.push("# 技能");
    for (const s of skillStats) paletteLines.push(`CC<=${s.target} ${s.label}`);
  }
  if (resources.some((r) => r.key === "san")) {
    paletteLines.push("# 正気度");
    paletteLines.push("CC<={SAN} SANチェック");
    paletteLines.push("1d3 SAN減少(小)");
    paletteLines.push("1d10 SAN減少(大)");
  }
  const charStats = stats.filter((s) => s.kind === "characteristic");
  if (charStats.length > 0) {
    paletteLines.push("# 能力値");
    for (const s of charStats) paletteLines.push(`CC<=${s.target} ${s.key}`);
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
    ...(noteBits.length > 0 ? { note: noteBits.join("\n\n") } : {}),
    ...(paletteLines.length > 0 ? { palette: paletteLines.join("\n") } : {}),
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

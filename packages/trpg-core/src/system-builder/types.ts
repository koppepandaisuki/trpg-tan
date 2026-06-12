import { CCSHEET_SCHEMA_VERSION } from "../character/types.js";
import type { Panel, PanelResource, PanelStat } from "../play/types.js";
import { panelColor } from "../play/panel.js";

/**
 * カスタムシステム定義(ノーコード・ビルダー)。
 *
 * CoC 以外のシステム(SW2.5 / DX3rd / シノビガミ…)を「能力値・技能・
 * リソース・判定コマンド雛形・チャットパレット雛形」の組み合わせとして
 * 宣言的に表現する。判定はチャットのダイスコマンド(notation / 比較)に
 * 落ちるので、ルールごとの専用ロジックを書かずに卓で遊べる。
 *
 * 雛形のプレースホルダ:
 *   - checkTemplate の {value} … クリックした能力値/技能の値
 *   - palette の {ラベル}      … キャラの能力値/技能の値(名前一致)
 *   - "?" は送信前に手で目標値へ書き換える想定(CCFOLIA 流)
 */

export interface SystemAttrDef {
  /** 短いキー(英字推奨。表示は label)。 */
  key: string;
  label: string;
  /** 新規キャラ作成時の初期値。 */
  initial: number;
}

export interface SystemSkillDef {
  label: string;
  initial: number;
}

export interface SystemResourceDef {
  key: string;
  label: string;
  /** 初期最大値(キャラごとに変更可)。 */
  max: number;
}

export interface SystemDef {
  /** 一意 id(プリセットは固定、カスタムは uuid)。 */
  id: string;
  name: string;
  /** 一覧表示用の絵文字。 */
  icon?: string;
  /**
   * 能力値/技能クリック時の判定コマンド雛形。{value} が値に置換され、
   * 末尾にラベルが付く。例 "2d6+{value}>=?" → "2d6+4>=? 敏捷度"。
   * 未設定ならチャットパレットのみで遊ぶ(クリックでラベルだけ流す)。
   */
  checkTemplate?: string;
  /** よく使う基本ダイス(例 "2d6")。パレット生成の補助。 */
  defaultRoll?: string;
  /** ダイスボット id(dice/dicebot.ts)。卓に取り込むと自動で切り替わる。 */
  diceBot?: string;
  attributes: SystemAttrDef[];
  skills: SystemSkillDef[];
  resources: SystemResourceDef[];
  /**
   * チャットパレット雛形(1 行 1 コマンド)。{能力値ラベル} 等は
   * キャラ作成時に値へ置換される(renderPaletteTemplate)。
   */
  palette?: string[];
  /** ルールの注意書き(簡略化した点など)。ビルダー/エディタで表示。 */
  note?: string;
  /** プリセット由来か(プリセットは直接編集せず複製して使う)。 */
  preset?: boolean;
}

/* ===== 汎用キャラクターシート(.ccsheet に kind:"generic" で保存) ===== */

export interface GenericSheet {
  schemaVersion: typeof CCSHEET_SCHEMA_VERSION;
  kind: "generic";
  id: string;
  /** 由来システム(SystemDef.id / name のスナップショット)。 */
  systemId: string;
  systemName: string;
  name: string;
  /** ポートレート(data URL)。 */
  image?: string | null;
  attributes: { key: string; label: string; value: number }[];
  skills: { label: string; value: number }[];
  resources: { key: string; label: string; current: number; max: number }[];
  memo?: string;
  /** 判定コマンド雛形(SystemDef からコピー。シート単位で調整可)。 */
  checkTemplate?: string;
  /** ダイスボット id(SystemDef からコピー。卓へ取り込むと反映)。 */
  diceBot?: string;
  /** チャットパレット(値置換済みの実体)。 */
  palette?: string;
}

/** 値が未保存の sheet を SystemDef から初期化する。 */
export function newGenericSheet(def: SystemDef, id: string): GenericSheet {
  const sheet: GenericSheet = {
    schemaVersion: CCSHEET_SCHEMA_VERSION,
    kind: "generic",
    id,
    systemId: def.id,
    systemName: def.name,
    name: "",
    image: null,
    attributes: def.attributes.map((a) => ({
      key: a.key,
      label: a.label,
      value: a.initial,
    })),
    skills: def.skills.map((s) => ({ label: s.label, value: s.initial })),
    resources: def.resources.map((r) => ({
      key: r.key,
      label: r.label,
      current: r.max,
      max: r.max,
    })),
    memo: "",
    checkTemplate: def.checkTemplate,
    ...(def.diceBot ? { diceBot: def.diceBot } : {}),
  };
  sheet.palette = renderPaletteTemplate(def.palette ?? [], sheet);
  return sheet;
}

/**
 * パレット雛形の {ラベル} をキャラの値に置換して 1 つのテキストへ。
 * ラベルは能力値(label / key)・技能(label)の順で解決。未知の {X} は残す
 * (手で書き換えられるように)。
 */
export function renderPaletteTemplate(
  lines: string[],
  sheet: Pick<GenericSheet, "attributes" | "skills">,
): string {
  const dict = new Map<string, number>();
  for (const a of sheet.attributes) {
    dict.set(a.label, a.value);
    if (a.key) dict.set(a.key, a.value);
  }
  for (const s of sheet.skills) {
    if (!dict.has(s.label)) dict.set(s.label, s.value);
  }
  return lines
    .map((line) =>
      line.replace(/\{([^{}]+)\}/g, (m, name: string) => {
        const v = dict.get(name.trim());
        return v === undefined ? m : String(v);
      }),
    )
    .join("\n");
}

/** GenericSheet から卓の駒(Panel)を作る。元シートは変更しない。 */
export function panelFromGeneric(params: {
  id: string;
  sheet: GenericSheet;
  color?: string;
}): Panel {
  const { id, sheet } = params;

  const stats: PanelStat[] = [
    ...sheet.attributes.map<PanelStat>((a) => ({
      key: a.key || a.label,
      label: a.label,
      value: a.value,
      target: a.value,
      kind: "characteristic",
    })),
    ...sheet.skills
      .filter((s) => s.label.trim() !== "")
      .map<PanelStat>((s) => ({
        key: s.label,
        label: s.label,
        value: s.value,
        target: s.value,
        kind: "skill",
      })),
  ];

  const resources: PanelResource[] = sheet.resources
    .filter((r) => r.label.trim() !== "")
    .map((r) => ({
      key: r.key || r.label,
      label: r.label,
      current: r.current,
      max: r.max,
    }));

  return {
    id,
    source: "sheet",
    name: sheet.name || "(名称未設定)",
    portrait: sheet.image ?? null,
    color: params.color ?? panelColor(id),
    systemId: sheet.systemId,
    systemName: sheet.systemName,
    sheetId: sheet.id,
    stats,
    resources,
    ...(sheet.checkTemplate ? { checkTemplate: sheet.checkTemplate } : {}),
    ...(sheet.palette ? { palette: sheet.palette } : {}),
  };
}

import type { Panel, PanelResource, PanelStat } from "./types.js";

/**
 * ココフォリア(Cocofolia)駒データの取り込み。
 *
 * ココフォリアの「コマをクリップボードにコピー」は事実上の標準フォーマットで、
 * キャラクター保管所(charasheet.vampire-blood.net)など多くのキャラ作成サイトが
 * 「ココフォリア出力」ボタンでこの JSON をクリップボードに書き出す。これを
 * 読めれば、他サイトで作ったキャラを PLAY の駒として登録できる。
 *
 * 形式(抜粋):
 *   {
 *     "kind": "character",
 *     "data": {
 *       "name": "探索者A",
 *       "memo": "...",
 *       "initiative": 11,
 *       "externalUrl": "https://...",
 *       "status": [ { "label": "HP", "value": 12, "max": 12 }, ... ],
 *       "params": [ { "label": "STR", "value": "13" }, ... ],
 *       "iconUrl": "https://...",
 *       "commands": "1d100<=60 【目星】\n1d100<=50 【聞き耳】",
 *       "color": "#888"
 *     }
 *   }
 *
 * 変換方針(「PLAY で使える」を最優先):
 *   - status  → resources(HP/MP/SAN…可変リソース)
 *   - commands→ palette(クリックで判定。ココフォリアの判定文化はここに集約)
 *   - params  → stats(表示用。target は値そのまま=クリック判定の保険)
 *   - iconUrl → portrait(http URL のまま。webview で表示可)
 *   - initiative → speed / memo → note / color → color
 */

interface CcfoliaStatus {
  label?: unknown;
  value?: unknown;
  max?: unknown;
}
interface CcfoliaParam {
  label?: unknown;
  value?: unknown;
}
interface CcfoliaData {
  name?: unknown;
  memo?: unknown;
  initiative?: unknown;
  iconUrl?: unknown;
  commands?: unknown;
  color?: unknown;
  status?: unknown;
  params?: unknown;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function toNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.trim());
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function toStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/**
 * クリップボード文字列(または既にパース済みオブジェクト)をココフォリア駒として
 * 解釈し、Panel を組み立てる。ココフォリア駒でない / 壊れている場合は null。
 *
 * id は呼び出し側で割り当てる(乱数を core に持ち込まないため、makeId を渡す)。
 */
export function parseCcfoliaCharacter(
  input: string | unknown,
  makeId: () => string,
): Panel | null {
  let root: unknown = input;
  if (typeof input === "string") {
    try {
      root = JSON.parse(input);
    } catch {
      return null;
    }
  }
  if (!isObj(root)) return null;
  if (root.kind !== "character") return null;
  if (!isObj(root.data)) return null;

  const data = root.data as CcfoliaData;

  const name = toStr(data.name).trim() || "コマ";

  // status → resources。value/max を数値化。max 欠落は value を流用。
  const resources: PanelResource[] = [];
  if (Array.isArray(data.status)) {
    for (const s of data.status as CcfoliaStatus[]) {
      if (!isObj(s)) continue;
      const label = toStr(s.label).trim();
      const value = toNum(s.value);
      if (!label || value === null) continue;
      const max = toNum(s.max);
      resources.push({
        key: label.toLowerCase(),
        label,
        current: value,
        max: max ?? value,
      });
    }
  }

  // params → stats(表示用)。target は値そのまま(クリックで 1d100<=値 になる
  // 保険。主力はあくまで palette のコマンド)。
  const stats: PanelStat[] = [];
  if (Array.isArray(data.params)) {
    for (const p of data.params as CcfoliaParam[]) {
      if (!isObj(p)) continue;
      const label = toStr(p.label).trim();
      const value = toNum(p.value);
      if (!label || value === null) continue;
      stats.push({
        key: label,
        label,
        value,
        target: value,
        kind: "characteristic",
      });
    }
  }

  const commands = toStr(data.commands).trim();
  const memo = toStr(data.memo).trim();
  const iconUrl = toStr(data.iconUrl).trim();
  const initiative = toNum(data.initiative);
  const color = toStr(data.color).trim();

  const panel: Panel = {
    id: makeId(),
    source: "token",
    name,
    portrait: iconUrl || null,
    color: color || "#7aa2f7",
    stats,
    resources,
    ...(commands ? { palette: commands } : {}),
    ...(memo ? { note: memo } : {}),
    ...(initiative !== null ? { speed: initiative } : {}),
  };
  return panel;
}

/**
 * クイックロール(お気に入りダイス)の保存(localStorage)。
 *
 * 毎回ダイス式を打ち込む手間を減らすための、ユーザー単位のお気に入り。
 * 卓やキャラには紐づかない(端末ローカル)。同期は不要 — 振る操作自体は
 * 既存の送信経路(handleSend)を通るので、結果は通常どおり全員に共有される。
 */

export interface QuickRoll {
  /** ダイス式(例: "2d6+1", "CCB<=70 目星", "1d100<=50 回避")。 */
  expr: string;
  /** 表示ラベル(任意)。未指定なら expr をそのまま見せる。 */
  label?: string;
}

const KEY = "trpg.quickRolls.v1";

/** プリセット(常時表示・編集不可)。汎用的によく使うダイス。 */
export const QUICK_ROLL_PRESETS: readonly string[] = [
  "1d100",
  "2d6",
  "1d6",
  "1d20",
  "1d10",
  "1d4",
  "1d8",
  "1d12",
];

/** お気に入り上限(UI が溢れないように)。 */
export const QUICK_ROLL_MAX = 16;

function sanitize(list: unknown): QuickRoll[] {
  if (!Array.isArray(list)) return [];
  const out: QuickRoll[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const expr = (item as { expr?: unknown }).expr;
    if (typeof expr !== "string") continue;
    const trimmed = expr.trim().slice(0, 120);
    if (!trimmed) continue;
    const rawLabel = (item as { label?: unknown }).label;
    const label =
      typeof rawLabel === "string" && rawLabel.trim()
        ? rawLabel.trim().slice(0, 40)
        : undefined;
    out.push({ expr: trimmed, label });
    if (out.length >= QUICK_ROLL_MAX) break;
  }
  return out;
}

export function getQuickRolls(): QuickRoll[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    return sanitize(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveQuickRolls(list: QuickRoll[]): QuickRoll[] {
  const next = sanitize(list);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* localStorage 不可でも UI 状態は保持される */
  }
  return next;
}

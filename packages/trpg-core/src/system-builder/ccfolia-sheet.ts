import { CCSHEET_SCHEMA_VERSION } from "../character/types.js";
import { parseCcfoliaCharacter } from "../play/ccfolia.js";
import type { GenericSheet } from "./types.js";

/**
 * ココフォリア駒(クリップボード JSON)→ 汎用キャラクターシート(.ccsheet)。
 *
 * PLAY への駒貼り付け(parseCcfoliaCharacter → Panel)と対になる、
 * キャラシ側の取り込み。卓に出す前にエディタで確認・保存できるよう
 * GenericSheet に変換する。
 *
 *   - status  → resources(HP/MP/SAN…)
 *   - params  → attributes(数値のみ。パレットの判定が主役なので表示用)
 *   - commands→ palette(ココフォリアの判定文化はそのまま活きる)
 *   - iconUrl → image(http URL のまま。呼び出し側で data URL 化してもよい)
 *   - memo    → memo
 *
 * ココフォリア駒でない/壊れている場合は null。
 */
export function genericSheetFromCcfolia(
  input: string | unknown,
  id: string,
): GenericSheet | null {
  const panel = parseCcfoliaCharacter(input, () => id);
  if (!panel) return null;
  return {
    schemaVersion: CCSHEET_SCHEMA_VERSION,
    kind: "generic",
    id,
    systemId: "ccfolia-import",
    systemName: "ココフォリア取り込み",
    name: panel.name === "コマ" ? "" : panel.name,
    image: panel.portrait ?? null,
    attributes: panel.stats.map((s) => ({
      key: s.key,
      label: s.label,
      value: s.value,
    })),
    skills: [],
    resources: panel.resources.map((r) => ({
      key: r.key,
      label: r.label,
      current: r.current,
      max: r.max,
    })),
    memo: panel.note ?? "",
    palette: panel.palette ?? "",
  };
}

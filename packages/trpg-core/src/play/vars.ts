import type { Panel } from "./types.js";

/**
 * チャットパレットの変数参照(ccfolia 風)。
 *
 *   "{共鳴}DM<=[強度]" のように {名前} / [名前] でキャラのデータ項目を参照する。
 *   置換は判定/ダイス解釈の前段で行い、見つかった項目を数値に差し替える。
 *   見つからない名前はそのまま残す(誤って 0 にしない)。
 */

/** パネル(キャラ駒)の参照可能な数値マップを作る(能力値/技能/リソース)。 */
export function panelVariables(panel: Panel): Record<string, number> {
  const vars: Record<string, number> = {};
  const put = (name: string | undefined, v: number) => {
    const k = name?.trim();
    if (!k) return;
    // 後から入れたものを優先しない(先勝ち)。重複ラベルは最初の値を使う。
    if (!(k in vars)) vars[k] = v;
    const lk = k.toLowerCase();
    if (!(lk in vars)) vars[lk] = v;
  };
  // 能力値/技能: ラベルと key の両方で引けるようにする。
  for (const s of panel.stats) {
    put(s.label, s.value);
    put(s.key, s.value);
  }
  // リソース: 現在値を参照(HP/MP/共鳴 等)。max は "名前_max" でも引ける。
  for (const r of panel.resources) {
    put(r.label, r.current);
    put(r.key, r.current);
    put(`${r.label}_max`, r.max);
    put(`${r.key}_max`, r.max);
  }
  return vars;
}

/**
 * 文字列中の {名前} / [名前] を vars の数値へ置換する。
 * 名前は前後空白を無視。未解決の参照は元の表記のまま残す。
 */
export function substituteVars(
  input: string,
  vars: Record<string, number>,
): string {
  return input.replace(/\{([^{}]+)\}|\[([^[\]]+)\]/g, (match, curly, square) => {
    const raw = (curly ?? square) as string;
    const name = raw.trim();
    const v =
      name in vars
        ? vars[name]
        : name.toLowerCase() in vars
          ? vars[name.toLowerCase()]
          : undefined;
    return v === undefined ? match : String(v);
  });
}

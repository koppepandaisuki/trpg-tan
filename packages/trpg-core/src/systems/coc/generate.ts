import { type RandomFn, defaultRandom } from "../../dice/random.js";
import { rollNotation } from "../../dice/notation.js";
import type { SystemDefinition } from "../types.js";

/**
 * 能力値生成。CoC の rollHint は "3D6*5" や "(2D6+6)*5"、"3D6+3" のような
 * 「ダイス記法 + 任意の ×倍率」で表される。notation 評価器は乗算を扱わない
 * ため、ここで「(EXPR)*K」/「EXPR*K」/「EXPR」を解釈して算出する。
 */
export function rollCharacteristicValue(
  rollHint: string,
  rng: RandomFn = defaultRandom,
): number {
  const compact = rollHint.replace(/\s+/g, "");
  const starIdx = compact.indexOf("*");
  if (starIdx === -1) {
    return rollNotation(compact, rng).total;
  }
  let left = compact.slice(0, starIdx);
  const mult = Number(compact.slice(starIdx + 1));
  if (!Number.isFinite(mult)) {
    throw new Error(`rollCharacteristicValue: 倍率が不正です: "${rollHint}"`);
  }
  if (left.startsWith("(") && left.endsWith(")")) {
    left = left.slice(1, -1);
  }
  return rollNotation(left, rng).total * mult;
}

/**
 * システム定義の全能力値を rollHint に従って生成する。rollHint の無い能力値は
 * スキップ(呼び出し側で手入力)。
 */
export function generateAllCharacteristics(
  system: SystemDefinition,
  rng: RandomFn = defaultRandom,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of system.characteristics) {
    if (c.rollHint) {
      out[c.key] = rollCharacteristicValue(c.rollHint, rng);
    }
  }
  return out;
}

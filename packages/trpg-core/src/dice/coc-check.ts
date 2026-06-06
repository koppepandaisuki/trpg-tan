import { type RandomFn, defaultRandom, rollDie } from "./random.js";

/**
 * クトゥルフ神話TRPG(CoC)の技能/能力値判定。1D100 を振り、目標値
 * (技能値)と比較して成功度を返す。6 版と 7 版で成功度の段階・ファンブル
 * 範囲が異なるため edition で分岐する。
 *
 * 注: ここで実装する基準は広く用いられる標準的な解釈であり、卓のハウス
 * ルールで上書きできるよう純粋関数に保つ。数値ルール(段階の境界)は
 * ゲームの仕組み=著作権保護外のため転記可能。
 *
 *  - 7 版: 1D100 ≤ 技能/5 → イクストリーム、≤ 技能/2 → ハード、
 *          ≤ 技能 → レギュラー。ファンブル = 技能<50 のとき 96–100、
 *          技能≥50 のとき 100。それ以外の失敗はフェイル。
 *  - 6 版: 1D100 ≤ 技能/5 → スペシャル(インペイル)、≤ 技能 → 成功。
 *          ファンブル = 技能<100 のとき 96–100、技能≥100 のとき 100。
 *          それ以外はフェイル。
 */

export type CoCEdition = "6" | "7";

export type CoCSuccessLevel =
  | "extreme" // 7e: ≤ 技能/5
  | "hard" // 7e: ≤ 技能/2
  | "special" // 6e: ≤ 技能/5(インペイル)
  | "regular" // ≤ 技能
  | "fail"
  | "fumble";

export interface CoCCheckResult {
  edition: CoCEdition;
  /** 1〜100 の出目 */
  roll: number;
  /** 目標値(技能値)*/
  target: number;
  level: CoCSuccessLevel;
  /** 成功(regular 以上)かどうか */
  isSuccess: boolean;
}

function isFumble(roll: number, target: number, fumbleFloorTarget: number): boolean {
  // 目標値が低いほどファンブル域が広い(96–100)、高いと 100 のみ。
  if (target < fumbleFloorTarget) return roll >= 96 && roll <= 100;
  return roll === 100;
}

/**
 * 出目(1〜100)を与えて成功度を判定する純粋関数(テスト容易)。
 */
export function resolveCoCCheck(
  roll: number,
  target: number,
  edition: CoCEdition,
): CoCCheckResult {
  if (!Number.isInteger(roll) || roll < 1 || roll > 100) {
    throw new Error(`resolveCoCCheck: roll は 1〜100 の整数で指定してください: ${roll}`);
  }
  const t = Math.max(0, Math.floor(target));
  const fifth = Math.floor(t / 5);

  let level: CoCSuccessLevel;
  if (edition === "7") {
    if (isFumble(roll, t, 50)) level = "fumble";
    else if (roll <= fifth && roll <= t) level = "extreme";
    else if (roll <= Math.floor(t / 2)) level = "hard";
    else if (roll <= t) level = "regular";
    else level = "fail";
  } else {
    if (isFumble(roll, t, 100)) level = "fumble";
    else if (roll <= fifth && roll <= t) level = "special";
    else if (roll <= t) level = "regular";
    else level = "fail";
  }

  const isSuccess =
    level === "regular" ||
    level === "hard" ||
    level === "extreme" ||
    level === "special";

  return { edition, roll, target: t, level, isSuccess };
}

/**
 * 1D100 を振って判定する(rng 注入可)。
 */
export function rollCoCCheck(
  target: number,
  edition: CoCEdition,
  rng: RandomFn = defaultRandom,
): CoCCheckResult {
  const roll = rollDie(100, rng);
  return resolveCoCCheck(roll, target, edition);
}

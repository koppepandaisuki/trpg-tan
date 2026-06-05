/**
 * 乱数源の抽象化。テストで決定的に差し替えられるよう、ダイス系の関数は
 * すべて RandomFn を注入可能にする(既定は Math.random)。
 *
 * RandomFn は [0, 1) の浮動小数を返す(Math.random 互換)。
 */
export type RandomFn = () => number;

export const defaultRandom: RandomFn = Math.random;

/**
 * 1〜sides の整数を一様に返す(サイコロ 1 個)。
 */
export function rollDie(sides: number, rng: RandomFn = defaultRandom): number {
  if (!Number.isInteger(sides) || sides < 1) {
    throw new Error(`rollDie: sides は 1 以上の整数で指定してください: ${sides}`);
  }
  return Math.floor(rng() * sides) + 1;
}

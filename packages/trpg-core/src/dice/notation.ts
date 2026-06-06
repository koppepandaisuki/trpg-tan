import { type RandomFn, defaultRandom, rollDie } from "./random.js";

/**
 * ダイス記法(例: "3d6", "1d100", "2d6+1d4-1", "1D6+3")の評価。
 *
 * 対応:
 *   - 複数項の加減算( + / - )
 *   - NdM 形式(N 省略可 → 1 個、d/D 両対応)
 *   - 定数項( +3, -1 など)
 *
 * 非対応(将来拡張): 乗除算、括弧、k/kh/kl(上位/下位採用)、爆発ダイス等。
 */

export interface DiceTerm {
  /** ダイスの個数(定数項なら 0)*/
  count: number;
  /** 面数(定数項なら 0)*/
  sides: number;
  /** 符号(+1 / -1)*/
  sign: 1 | -1;
  /** 定数項の値(ダイス項なら 0)*/
  constant: number;
}

export interface DiceRollResult {
  notation: string;
  /** 各ダイスの出目(定数項は含めない、評価順)*/
  rolls: number[];
  /** 合計(符号・定数込み)*/
  total: number;
  /** 解析した項(デバッグ/表示用)*/
  terms: DiceTerm[];
}

const TERM_RE = /([+-]?)\s*(?:(\d*)[dD](\d+)|(\d+))/g;

/**
 * 記法を項配列に解析する。解析できない/空ならエラー。
 */
export function parseDiceNotation(notation: string): DiceTerm[] {
  const compact = notation.replace(/\s+/g, "");
  if (compact.length === 0) {
    throw new Error("parseDiceNotation: 空の記法です");
  }

  const terms: DiceTerm[] = [];
  let consumed = 0;
  TERM_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TERM_RE.exec(compact)) !== null) {
    consumed += m[0].length;
    const sign: 1 | -1 = m[1] === "-" ? -1 : 1;
    if (m[3] !== undefined) {
      // NdM 形式
      const count = m[2] === "" ? 1 : Number(m[2]);
      const sides = Number(m[3]);
      if (count < 1 || sides < 1) {
        throw new Error(`parseDiceNotation: 不正なダイス項です: ${m[0]}`);
      }
      terms.push({ count, sides, sign, constant: 0 });
    } else {
      // 定数項
      terms.push({ count: 0, sides: 0, sign, constant: Number(m[4]) });
    }
  }

  if (terms.length === 0 || consumed !== compact.length) {
    throw new Error(`parseDiceNotation: 解析できない記法です: "${notation}"`);
  }
  return terms;
}

/**
 * 記法を実際に振って結果を返す。rng を渡すとテストで決定的にできる。
 */
export function rollNotation(
  notation: string,
  rng: RandomFn = defaultRandom,
): DiceRollResult {
  const terms = parseDiceNotation(notation);
  const rolls: number[] = [];
  let total = 0;

  for (const t of terms) {
    if (t.count > 0) {
      for (let i = 0; i < t.count; i++) {
        const r = rollDie(t.sides, rng);
        rolls.push(r);
        total += t.sign * r;
      }
    } else {
      total += t.sign * t.constant;
    }
  }

  return { notation, rolls, total, terms };
}

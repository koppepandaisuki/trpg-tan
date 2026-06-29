import { type RandomFn, defaultRandom, rollDie } from "./random.js";

/**
 * ダイス記法/計算式の評価。
 *
 * 対応:
 *   - 加減算 + - / 乗除算 * / / 剰余 % / 累乗 ^(右結合)
 *   - 括弧 ( )
 *   - NdM 形式(N 省略可 → 1 個、d/D 両対応)
 *   - 単項マイナス( -2d6 など )
 *
 * 例: "3d6", "2d6+1d4-1", "(2d6+1)*2", "1d100/2", "2^3+1d6"
 *
 * 割り算は切り捨て(BCDice 既定に合わせて floor)。0 除算はエラー。
 */

export interface DiceTerm {
  /** ダイスの個数(定数項なら 0)*/
  count: number;
  /** 面数(定数項なら 0)*/
  sides: number;
  /** 符号(+1 / -1)。式中の係数は表現できないため表示補助の近似。*/
  sign: 1 | -1;
  /** 定数項の値(ダイス項なら 0)*/
  constant: number;
}

export interface DiceRollResult {
  notation: string;
  /** 各ダイスの出目(評価順、定数は含めない)*/
  rolls: number[];
  /** 合計(式全体の評価値)*/
  total: number;
  /** 解析した項(デバッグ/表示用、近似)*/
  terms: DiceTerm[];
}

/* ===== トークナイザ ===== */

type Tok =
  | { t: "num"; v: number }
  | { t: "dice"; count: number; sides: number }
  | { t: "op"; v: "+" | "-" | "*" | "/" | "%" | "^" }
  | { t: "lp" }
  | { t: "rp" };

const MAX_DICE = 1000;
const MAX_SIDES = 1_000_000;

function tokenize(input: string): Tok[] {
  const s = input.replace(/\s+/g, "");
  if (s.length === 0) throw new Error("空の式です");
  const toks: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === "(") {
      toks.push({ t: "lp" });
      i++;
    } else if (c === ")") {
      toks.push({ t: "rp" });
      i++;
    } else if (c === "+" || c === "-" || c === "*" || c === "/" || c === "%" || c === "^") {
      toks.push({ t: "op", v: c });
      i++;
    } else if (/[0-9dD]/.test(c)) {
      // 数値 or NdM。先頭が d のとき count 省略(1)。
      const m = /^(\d*)[dD](\d+)|^(\d+)/.exec(s.slice(i));
      if (!m) throw new Error(`解析できません: "${s.slice(i)}"`);
      if (m[2] !== undefined) {
        const count = m[1] === "" ? 1 : Number(m[1]);
        const sides = Number(m[2]);
        if (count < 1 || sides < 1 || count > MAX_DICE || sides > MAX_SIDES) {
          throw new Error(`不正なダイス: ${m[0]}`);
        }
        toks.push({ t: "dice", count, sides });
      } else {
        toks.push({ t: "num", v: Number(m[3]) });
      }
      i += m[0].length;
    } else {
      throw new Error(`解析できない文字: "${c}"`);
    }
  }
  return toks;
}

/* ===== パーサ(AST) ===== */

type Node =
  | { t: "num"; v: number }
  | { t: "dice"; count: number; sides: number }
  | { t: "neg"; e: Node }
  | { t: "bin"; op: "+" | "-" | "*" | "/" | "%" | "^"; l: Node; r: Node };

const PREC: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2, "^": 3 };

function parseTokens(toks: Tok[]): Node {
  let pos = 0;
  const peek = () => toks[pos];

  function primary(): Node {
    const tk = peek();
    if (!tk) throw new Error("式が途中で終わっています");
    if (tk.t === "op" && (tk.v === "+" || tk.v === "-")) {
      pos++;
      const e = primary();
      return tk.v === "-" ? { t: "neg", e } : e;
    }
    if (tk.t === "num") {
      pos++;
      return { t: "num", v: tk.v };
    }
    if (tk.t === "dice") {
      pos++;
      return { t: "dice", count: tk.count, sides: tk.sides };
    }
    if (tk.t === "lp") {
      pos++;
      const e = expr(1);
      if (peek()?.t !== "rp") throw new Error("括弧が閉じていません");
      pos++;
      return e;
    }
    throw new Error("数値かダイスが必要です");
  }

  // 累乗は右結合、それ以外は左結合。
  function expr(minPrec: number): Node {
    let left = primary();
    for (;;) {
      const tk = peek();
      if (!tk || tk.t !== "op") break;
      const prec = PREC[tk.v];
      if (prec < minPrec) break;
      pos++;
      const nextMin = tk.v === "^" ? prec : prec + 1;
      const right = expr(nextMin);
      left = { t: "bin", op: tk.v, l: left, r: right };
    }
    return left;
  }

  const ast = expr(1);
  if (pos !== toks.length) throw new Error("式を解析しきれませんでした");
  return ast;
}

function evalNode(n: Node, rng: RandomFn, rolls: number[]): number {
  switch (n.t) {
    case "num":
      return n.v;
    case "dice": {
      let sum = 0;
      for (let i = 0; i < n.count; i++) {
        const r = rollDie(n.sides, rng);
        rolls.push(r);
        sum += r;
      }
      return sum;
    }
    case "neg":
      return -evalNode(n.e, rng, rolls);
    case "bin": {
      const a = evalNode(n.l, rng, rolls);
      const b = evalNode(n.r, rng, rolls);
      switch (n.op) {
        case "+":
          return a + b;
        case "-":
          return a - b;
        case "*":
          return a * b;
        case "/":
          if (b === 0) throw new Error("0 で割れません");
          return Math.floor(a / b); // 切り捨て(BCDice 既定)
        case "%":
          if (b === 0) throw new Error("0 で割れません");
          return a % b;
        case "^":
          return Math.pow(a, b);
      }
    }
  }
}

function collectTerms(n: Node, out: DiceTerm[], sign: 1 | -1 = 1): void {
  const flip = (s: 1 | -1): 1 | -1 => (s === 1 ? -1 : 1);
  switch (n.t) {
    case "num":
      out.push({ count: 0, sides: 0, sign, constant: n.v });
      break;
    case "dice":
      out.push({ count: n.count, sides: n.sides, sign, constant: 0 });
      break;
    case "neg":
      collectTerms(n.e, out, flip(sign));
      break;
    case "bin":
      if (n.op === "+") {
        collectTerms(n.l, out, sign);
        collectTerms(n.r, out, sign);
      } else if (n.op === "-") {
        collectTerms(n.l, out, sign);
        collectTerms(n.r, out, flip(sign));
      } else {
        // 乗除算/累乗は符号付き項では表現できないため近似(符号 +1)。
        collectTerms(n.l, out, 1);
        collectTerms(n.r, out, 1);
      }
      break;
  }
}

/**
 * 記法/式を項配列に解析する(主に妥当性チェック用)。解析できない/空ならエラー。
 */
export function parseDiceNotation(notation: string): DiceTerm[] {
  const ast = parseTokens(tokenize(notation));
  const terms: DiceTerm[] = [];
  collectTerms(ast, terms);
  return terms;
}

/**
 * 記法/式を実際に評価して返す。rng を渡すとテストで決定的にできる。
 */
export function rollNotation(
  notation: string,
  rng: RandomFn = defaultRandom,
): DiceRollResult {
  const ast = parseTokens(tokenize(notation));
  const rolls: number[] = [];
  const total = evalNode(ast, rng, rolls);
  const terms: DiceTerm[] = [];
  collectTerms(ast, terms);
  return { notation, rolls, total, terms };
}

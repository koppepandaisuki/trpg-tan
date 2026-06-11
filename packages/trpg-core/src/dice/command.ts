import { type RandomFn, defaultRandom } from "./random.js";
import {
  parseDiceNotation,
  rollNotation,
  type DiceRollResult,
} from "./notation.js";

/**
 * チャット欄に打ったダイスコマンドの解釈(CCFOLIA / どどんとふ風)。
 *
 *   2d6+1            → notation(記法ロール)
 *   1d100            → notation
 *   1d100<=70 目星    → coc(1d100 の ≤ 判定は CoC 成功度として扱う)
 *   CC<=70 / CCB(70) → coc
 *   2d6>=8 ダメージ    → compare(任意ダイスの成否)
 *   それ以外          → none(通常チャット)
 *
 * 純粋関数(乱数なし)。実際のロールは compareRoll / 既存の roll* が行う。
 */

export type CompareOp = "<=" | "<" | ">=" | ">" | "==";

export type DiceCommand =
  | { kind: "none" }
  | { kind: "notation"; notation: string; label: string }
  | { kind: "coc"; target: number; label: string }
  | {
      kind: "compare";
      notation: string;
      op: CompareOp;
      target: number;
      label: string;
    }
  | { kind: "choice"; options: string[]; label: string };

/** 記法として解釈でき、かつダイス(d)を含むか。 */
function isDiceRoll(s: string): boolean {
  if (!/d\d/i.test(s)) return false; // 定数だけ("12" 等)はロール扱いしない
  try {
    parseDiceNotation(s);
    return true;
  } catch {
    return false;
  }
}

function normalizeOp(raw: string): CompareOp {
  switch (raw) {
    case "<=":
    case "≦":
      return "<=";
    case ">=":
    case "≧":
      return ">=";
    case "<":
      return "<";
    case ">":
      return ">";
    default:
      return "=="; // "=" / "=="
  }
}

export function parseDiceCommand(input: string): DiceCommand {
  const s = input.trim();
  if (!s) return { kind: "none" };

  // choice[a,b,c] / choice[a、b、c]: 選択肢からランダムに 1 つ選ぶ(BCDice 風)。
  const ch = s.match(/^choice\[(.+)\]$/i);
  if (ch) {
    const options = ch[1]
      .split(/[,、]/)
      .map((o) => o.trim())
      .filter(Boolean);
    if (options.length >= 2) {
      return { kind: "choice", options, label: s };
    }
  }

  // CoC: CC / CCB (+ 任意の <= / 括弧) + 目標値。例 CC<=70, CCB(70), CCB70
  const cc = s.match(/^ccb?(?:<=|≦)?\s*\(?(\d{1,3})\)?(?:\s+(.+))?$/i);
  if (cc) {
    const target = Number(cc[1]);
    return { kind: "coc", target, label: cc[2]?.trim() || `CCB<=${target}` };
  }

  // <式><比較><目標値> [ラベル]
  const cmp = s.match(/^(\S+?)(<=|>=|==|=|<|>|≦|≧)(\d+)(?:\s+(.+))?$/);
  if (cmp) {
    const notation = cmp[1];
    const op = normalizeOp(cmp[2]);
    const target = Number(cmp[3]);
    const trailing = cmp[4]?.trim();
    if (isDiceRoll(notation)) {
      // 1d100<=N は CoC 判定(成功度＋演出)として扱う
      if (op === "<=" && /^1?d100$/i.test(notation)) {
        return { kind: "coc", target, label: trailing || `${notation}<=${target}` };
      }
      return {
        kind: "compare",
        notation,
        op,
        target,
        label: trailing || `${notation}${cmp[2]}${target}`,
      };
    }
    return { kind: "none" };
  }

  // 純粋な記法 [ラベル]
  const note = s.match(/^(\S+)(?:\s+(.+))?$/);
  if (note && isDiceRoll(note[1])) {
    return { kind: "notation", notation: note[1], label: note[2]?.trim() || note[1] };
  }

  return { kind: "none" };
}

export interface CompareRollResult extends DiceRollResult {
  op: CompareOp;
  target: number;
  success: boolean;
}

function compare(total: number, op: CompareOp, target: number): boolean {
  switch (op) {
    case "<=":
      return total <= target;
    case "<":
      return total < target;
    case ">=":
      return total >= target;
    case ">":
      return total > target;
    case "==":
      return total === target;
  }
}

/** 比較付きロール(2d6>=8 等)。成否を判定して返す。 */
export function compareRoll(
  notation: string,
  op: CompareOp,
  target: number,
  rng: RandomFn = defaultRandom,
): CompareRollResult {
  const r = rollNotation(notation, rng);
  return { ...r, op, target, success: compare(r.total, op, target) };
}

import type { SystemDefinition, OccupationDef, SkillDef } from "../types.js";

/**
 * 技能ポイントの割り振り検証(CoC)。職業技能ポイントと興味技能ポイントの
 * 2 つの予算(プール)に対し、各技能へ割り振った点数の合計・残り・違反を返す。
 *
 * 予算式(skillPointsFormula / interestPointsFormula)は "EDU*4" や
 * "EDU*2+DEX*2"、"INT*10" のような「能力値×係数の和」。これらは数値ルール=
 * 著作権保護外。式評価器 evalPointFormula で算出する。
 */

function factorValue(token: string, chars: Record<string, number>): number {
  if (/^\d+$/.test(token)) return Number(token);
  if (/^[A-Za-z]+$/.test(token)) {
    const v = chars[token];
    return Number.isFinite(v) ? v : 0;
  }
  throw new Error(`evalPointFormula: 不正なトークン: "${token}"`);
}

/**
 * "EDU*4" / "EDU*2+DEX*2" / "INT*10" / "DEX/2" を評価。未知の能力値は 0 扱い
 * (寛容)。項は + 区切り、各項内は * と / を左から評価する。
 */
export function evalPointFormula(
  formula: string,
  chars: Record<string, number>,
): number {
  const compact = formula.replace(/\s+/g, "");
  if (compact.length === 0) {
    throw new Error("evalPointFormula: 空の式です");
  }
  let total = 0;
  for (const term of compact.split("+")) {
    if (term.length === 0) {
      throw new Error(`evalPointFormula: 不正な式です: "${formula}"`);
    }
    // "DEX/2" → ["DEX", "/", "2"]
    const tokens = term.split(/([*/])/);
    let acc = factorValue(tokens[0], chars);
    for (let i = 1; i < tokens.length; i += 2) {
      const op = tokens[i];
      const val = factorValue(tokens[i + 1] ?? "", chars);
      acc = op === "/" ? acc / val : acc * val;
    }
    total += acc;
  }
  return total;
}

/**
 * 技能の実効初期値。baseFormula があれば能力値から算出して切り捨て、
 * 無ければ固定 base を返す(例 7版 回避 "DEX/2"、母国語 "EDU")。
 */
export function skillBaseValue(
  skill: SkillDef,
  chars: Record<string, number>,
): number {
  if (skill.baseFormula) {
    return Math.floor(evalPointFormula(skill.baseFormula, chars));
  }
  return skill.base;
}

export type AllocationErrorCode =
  | "over_occupation" // 職業ポイント超過
  | "over_interest" // 興味ポイント超過
  | "non_occupation_skill" // 職業ポイントを職業技能以外に使用
  | "skill_over_max" // 技能値が上限超過
  | "negative_points"; // 負の割り振り

export interface AllocationError {
  code: AllocationErrorCode;
  skillKey?: string;
  message: string;
}

export interface SkillAllocation {
  /** skill キー → 職業ポイントからの割り振り */
  occupation?: Record<string, number>;
  /** skill キー → 興味ポイントからの割り振り */
  interest?: Record<string, number>;
}

export interface AllocationResult {
  occupationBudget: number;
  interestBudget: number;
  spentOccupation: number;
  spentInterest: number;
  remainingOccupation: number;
  remainingInterest: number;
  /** 触れた技能の最終値(base + 職業 + 興味)*/
  finalValues: Record<string, number>;
  errors: AllocationError[];
  valid: boolean;
}

function sumValues(rec: Record<string, number> | undefined): number {
  if (!rec) return 0;
  let s = 0;
  for (const v of Object.values(rec)) s += v;
  return s;
}

/**
 * 割り振りを検証する。
 *
 * @param maxSkill 技能値の上限(既定: 7版=99, 6版=undefined で無制限)
 */
export function validateSkillAllocation(
  system: SystemDefinition,
  occupation: OccupationDef,
  chars: Record<string, number>,
  allocation: SkillAllocation,
  opts: { maxSkill?: number } = {},
): AllocationResult {
  const occupationBudget = evalPointFormula(occupation.skillPointsFormula, chars);
  const interestBudget = evalPointFormula(system.interestPointsFormula, chars);
  const spentOccupation = sumValues(allocation.occupation);
  const spentInterest = sumValues(allocation.interest);

  const maxSkill = opts.maxSkill ?? (system.edition === "7" ? 99 : undefined);
  const skillByKey = new Map(system.skills.map((s) => [s.key, s] as const));
  const occSkillSet = new Set(occupation.occupationSkills);

  const errors: AllocationError[] = [];

  // 予算超過
  if (spentOccupation > occupationBudget) {
    errors.push({
      code: "over_occupation",
      message: `職業技能ポイントを ${spentOccupation - occupationBudget} 超過しています`,
    });
  }
  if (spentInterest > interestBudget) {
    errors.push({
      code: "over_interest",
      message: `興味技能ポイントを ${spentInterest - interestBudget} 超過しています`,
    });
  }

  // 触れた全技能キーを集約
  const touched = new Set<string>([
    ...Object.keys(allocation.occupation ?? {}),
    ...Object.keys(allocation.interest ?? {}),
  ]);

  const finalValues: Record<string, number> = {};
  for (const key of touched) {
    const occ = allocation.occupation?.[key] ?? 0;
    const intr = allocation.interest?.[key] ?? 0;

    if (occ < 0 || intr < 0) {
      errors.push({
        code: "negative_points",
        skillKey: key,
        message: `${key}: 負のポイントは割り振れません`,
      });
    }
    // 職業ポイントは職業技能にのみ
    if (occ > 0 && !occSkillSet.has(key)) {
      errors.push({
        code: "non_occupation_skill",
        skillKey: key,
        message: `${key} は職業技能ではないため職業ポイントを割り振れません`,
      });
    }

    const skillDef = skillByKey.get(key);
    const base = skillDef ? skillBaseValue(skillDef, chars) : 0;
    const value = base + occ + intr;
    finalValues[key] = value;

    if (maxSkill !== undefined && value > maxSkill) {
      errors.push({
        code: "skill_over_max",
        skillKey: key,
        message: `${key} が上限 ${maxSkill} を超えています(${value})`,
      });
    }
  }

  return {
    occupationBudget,
    interestBudget,
    spentOccupation,
    spentInterest,
    remainingOccupation: occupationBudget - spentOccupation,
    remainingInterest: interestBudget - spentInterest,
    finalValues,
    errors,
    valid: errors.length === 0,
  };
}

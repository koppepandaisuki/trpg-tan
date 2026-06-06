import { describe, it, expect } from "vitest";
import {
  evalPointFormula,
  skillBaseValue,
  validateSkillAllocation,
} from "../src/systems/coc/allocate.js";
import { coc7 } from "../src/systems/coc/coc7.js";
import type { OccupationDef, SkillDef } from "../src/systems/types.js";

const detective7 = coc7.occupations.find((o) => o.id === "detective")!;

describe("evalPointFormula", () => {
  const chars = { EDU: 60, INT: 50, DEX: 40 };
  it("単項 'EDU*4'", () => {
    expect(evalPointFormula("EDU*4", chars)).toBe(240);
  });
  it("混合 'EDU*2+DEX*2'", () => {
    expect(evalPointFormula("EDU*2+DEX*2", chars)).toBe(120 + 80);
  });
  it("'INT*2'(興味)", () => {
    expect(evalPointFormula("INT*2", chars)).toBe(100);
  });
  it("未知の能力値は 0 扱い", () => {
    expect(evalPointFormula("POW*5", chars)).toBe(0);
  });
  it("除算 'DEX/2' を評価する", () => {
    expect(evalPointFormula("DEX/2", { DEX: 40 })).toBe(20);
    expect(evalPointFormula("EDU*5", { EDU: 16 })).toBe(80);
  });
  it("不正なトークンは例外", () => {
    expect(() => evalPointFormula("EDU*", chars)).toThrow();
    expect(() => evalPointFormula("", chars)).toThrow();
  });
});

describe("skillBaseValue", () => {
  it("固定 base の技能はそのまま", () => {
    const s: SkillDef = { key: "spot", label: "目星", base: 25 };
    expect(skillBaseValue(s, {})).toBe(25);
  });
  it("baseFormula があれば能力値から算出して切り捨て", () => {
    const dodge: SkillDef = {
      key: "dodge",
      label: "回避",
      base: 0,
      baseFormula: "DEX/2",
    };
    expect(skillBaseValue(dodge, { DEX: 55 })).toBe(27); // floor(27.5)
    const lang: SkillDef = {
      key: "own_language",
      label: "母国語",
      base: 0,
      baseFormula: "EDU",
    };
    expect(skillBaseValue(lang, { EDU: 70 })).toBe(70);
  });
});

describe("validateSkillAllocation — 7版", () => {
  // detective = EDU*2+DEX*2 = 200, 興味 INT*2 = 100
  const chars = { EDU: 50, INT: 50, DEX: 50 };

  it("予算と残りを正しく算出する", () => {
    const r = validateSkillAllocation(coc7, detective7, chars, {
      occupation: { spot_hidden: 50, persuade: 50 },
      interest: { occult: 20 },
    });
    expect(r.occupationBudget).toBe(200);
    expect(r.interestBudget).toBe(100);
    expect(r.spentOccupation).toBe(100);
    expect(r.spentInterest).toBe(20);
    expect(r.remainingOccupation).toBe(100);
    expect(r.remainingInterest).toBe(80);
    expect(r.valid).toBe(true);
  });

  it("最終値は base + 職業 + 興味", () => {
    const r = validateSkillAllocation(coc7, detective7, chars, {
      occupation: { spot_hidden: 50 }, // base25 +50 = 75
      interest: { spot_hidden: 10 }, // +10 = 85
    });
    expect(r.finalValues.spot_hidden).toBe(85);
  });

  it("職業ポイント超過を検出", () => {
    const r = validateSkillAllocation(coc7, detective7, chars, {
      occupation: { spot_hidden: 250 },
    });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.code === "over_occupation")).toBe(true);
  });

  it("職業技能以外への職業ポイントを検出", () => {
    // occult は探偵の職業技能ではない
    const r = validateSkillAllocation(coc7, detective7, chars, {
      occupation: { occult: 10 },
    });
    expect(r.errors.some((e) => e.code === "non_occupation_skill")).toBe(true);
  });

  it("上限 99 超過を検出(7版)", () => {
    const r = validateSkillAllocation(coc7, detective7, chars, {
      occupation: { spot_hidden: 80 }, // base25+80=105 > 99
    });
    expect(r.errors.some((e) => e.code === "skill_over_max")).toBe(true);
  });

  it("負のポイントを検出", () => {
    const r = validateSkillAllocation(coc7, detective7, chars, {
      interest: { occult: -5 },
    });
    expect(r.errors.some((e) => e.code === "negative_points")).toBe(true);
  });
});

describe("validateSkillAllocation — maxSkill 指定", () => {
  it("maxSkill を上書きできる", () => {
    const occ: OccupationDef = {
      ...detective7,
      occupationSkills: ["spot_hidden"],
    };
    const r = validateSkillAllocation(
      coc7,
      occ,
      { EDU: 50, INT: 50 },
      { occupation: { spot_hidden: 60 } }, // base25+60=85
      { maxSkill: 80 },
    );
    expect(r.errors.some((e) => e.code === "skill_over_max")).toBe(true);
  });
});

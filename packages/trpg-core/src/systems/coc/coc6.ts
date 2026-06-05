import type { SystemDefinition } from "../types.js";

/**
 * クトゥルフ神話TRPG 第6版のシステム定義(骨組み)。
 *
 * 7 版との主な違い:
 *   - 能力値は素の 3D6 / 2D6+6 系(3〜18 程度)で表現(*5 しない)
 *   - 職業技能ポイントは EDU*20、興味は INT*10
 *   - HP=(CON+SIZ)/2、MP=POW、SAN=POW*5
 *
 * skills / occupations は代表例のみ。完全版は別タスク(機能データ転記+説明自作)。
 */
export const coc6: SystemDefinition = {
  id: "coc6",
  label: "クトゥルフ神話TRPG(第6版)",
  family: "coc",
  edition: "6",
  characteristics: [
    { key: "STR", label: "筋力", rollHint: "3D6", min: 3, max: 18 },
    { key: "CON", label: "体力", rollHint: "3D6", min: 3, max: 18 },
    { key: "SIZ", label: "体格", rollHint: "2D6+6", min: 8, max: 18 },
    { key: "DEX", label: "敏捷性", rollHint: "3D6", min: 3, max: 18 },
    { key: "APP", label: "外見", rollHint: "3D6", min: 3, max: 18 },
    { key: "INT", label: "知性", rollHint: "2D6+6", min: 8, max: 18 },
    { key: "POW", label: "精神力", rollHint: "3D6", min: 3, max: 18 },
    { key: "EDU", label: "教育", rollHint: "3D6+3", min: 6, max: 21 },
  ],
  derived: [
    { key: "HP", label: "耐久力", formula: "(CON+SIZ)/2" },
    { key: "MP", label: "マジックポイント", formula: "POW" },
    { key: "SAN", label: "正気度", formula: "POW*5" },
    { key: "DB", label: "ダメージボーナス", formula: "f(STR+SIZ)" },
    { key: "IDEA", label: "アイデア", formula: "INT*5" },
    { key: "LUCK", label: "幸運", formula: "POW*5" },
    { key: "KNOW", label: "知識", formula: "EDU*5" },
  ],
  skills: [
    { key: "spot_hidden", label: "目星", base: 25, category: "探索" },
    { key: "listen", label: "聞き耳", base: 25, category: "探索" },
    { key: "library_use", label: "図書館", base: 25, category: "探索" },
    { key: "psychology", label: "心理学", base: 5, category: "対人" },
    { key: "persuade", label: "説得", base: 15, category: "対人" },
    { key: "dodge", label: "回避", base: 0, category: "戦闘" }, // 実際は DEX*2
    { key: "first_aid", label: "応急手当", base: 30, category: "技術" },
    { key: "occult", label: "オカルト", base: 5, category: "知識" },
    { key: "cthulhu_mythos", label: "クトゥルフ神話", base: 0, category: "知識" },
  ],
  interestPointsFormula: "INT*10",
  occupations: [
    {
      id: "detective",
      name: "探偵",
      description:
        "依頼を受けて調査や尾行、聞き込みを行う私立の調査員。観察力と人脈を武器に真相へ近づく。",
      skillPointsFormula: "EDU*20",
      occupationSkills: [
        "spot_hidden",
        "listen",
        "psychology",
        "persuade",
        "library_use",
        "first_aid",
      ],
      creditRating: { min: 20, max: 45 },
    },
    {
      id: "journalist",
      name: "記者",
      description:
        "事件や人物を取材し記事にする書き手。情報源を辿り、隠された事実を掘り起こすことに長ける。",
      skillPointsFormula: "EDU*20",
      occupationSkills: [
        "library_use",
        "psychology",
        "persuade",
        "spot_hidden",
        "occult",
      ],
      creditRating: { min: 9, max: 30 },
    },
  ],
};

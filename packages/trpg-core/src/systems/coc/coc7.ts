import type { SystemDefinition } from "../types.js";

/**
 * クトゥルフ神話TRPG 第7版のシステム定義(骨組み)。
 *
 * NOTE: skills / occupations は代表例のみ収録。完全版は別途データ作成タスク
 * (機能データは転記、説明文は自作)で拡充する。数値(能力値レンジ・技能
 * ポイント式・信用点数)はゲームの仕組み=著作権保護外。
 *
 * 7 版の能力値は 0–99(3D6*5 等)で表現する。
 */
export const coc7: SystemDefinition = {
  id: "coc7",
  label: "クトゥルフ神話TRPG(第7版)",
  family: "coc",
  edition: "7",
  characteristics: [
    { key: "STR", label: "筋力", rollHint: "3D6*5", min: 0, max: 99 },
    { key: "CON", label: "体力", rollHint: "3D6*5", min: 0, max: 99 },
    { key: "SIZ", label: "体格", rollHint: "(2D6+6)*5", min: 0, max: 99 },
    { key: "DEX", label: "敏捷性", rollHint: "3D6*5", min: 0, max: 99 },
    { key: "APP", label: "外見", rollHint: "3D6*5", min: 0, max: 99 },
    { key: "INT", label: "知性", rollHint: "(2D6+6)*5", min: 0, max: 99 },
    { key: "POW", label: "精神力", rollHint: "3D6*5", min: 0, max: 99 },
    { key: "EDU", label: "教育", rollHint: "(2D6+6)*5", min: 0, max: 99 },
  ],
  derived: [
    { key: "HP", label: "耐久力", formula: "(CON+SIZ)/10" },
    { key: "MP", label: "マジックポイント", formula: "POW/5" },
    { key: "SAN", label: "正気度", formula: "POW" },
    { key: "DB", label: "ダメージボーナス", formula: "f(STR+SIZ)" },
    { key: "BUILD", label: "ビルド", formula: "f(STR+SIZ)" },
    { key: "MOV", label: "移動率", formula: "f(STR,DEX,SIZ,age)" },
  ],
  // 代表的な技能のみ(完全版は後続)。base は % 初期値。
  skills: [
    { key: "spot_hidden", label: "目星", base: 25, category: "探索" },
    { key: "listen", label: "聞き耳", base: 20, category: "探索" },
    { key: "library_use", label: "図書館", base: 20, category: "探索" },
    { key: "psychology", label: "心理学", base: 10, category: "対人" },
    { key: "persuade", label: "説得", base: 10, category: "対人" },
    { key: "dodge", label: "回避", base: 0, category: "戦闘" }, // 実際は DEX/2
    { key: "first_aid", label: "応急手当", base: 30, category: "技術" },
    { key: "occult", label: "オカルト", base: 5, category: "知識" },
    { key: "cthulhu_mythos", label: "クトゥルフ神話", base: 0, category: "知識" },
  ],
  interestPointsFormula: "INT*2",
  // 代表職業のみ(説明文は自作)。完全版は後続のデータ作成タスク。
  occupations: [
    {
      id: "detective",
      name: "探偵",
      description:
        "依頼を受けて調査や尾行、聞き込みを行う私立の調査員。観察力と人脈を武器に真相へ近づく。",
      skillPointsFormula: "EDU*4",
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
      skillPointsFormula: "EDU*4",
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

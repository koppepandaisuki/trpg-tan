import type { SystemDefinition } from "../types.js";

/**
 * クトゥルフ神話TRPG 第6版のシステム定義。
 *
 * 7 版との主な違い:
 *   - 能力値は素の 3D6 / 2D6+6 系(3〜18 程度)
 *   - 職業技能ポイント = EDU*20、興味 = INT*10
 *   - HP=(CON+SIZ)/2、MP=POW、SAN=POW*5
 *   - 回避 = DEX*2、母国語 = EDU*5
 *
 * 数値ルールは転記、職業説明文は自作。
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
  interestPointsFormula: "INT*10",
  skills: [
    // 探索・知覚
    { key: "spot_hidden", label: "目星", base: 25, category: "探索" },
    { key: "listen", label: "聞き耳", base: 25, category: "探索" },
    { key: "library_use", label: "図書館", base: 25, category: "探索" },
    { key: "navigate", label: "ナビゲート", base: 10, category: "探索" },
    { key: "track", label: "追跡", base: 10, category: "探索" },
    // 対人
    { key: "psychology", label: "心理学", base: 5, category: "対人" },
    { key: "persuade", label: "説得", base: 15, category: "対人" },
    { key: "fast_talk", label: "言いくるめ", base: 5, category: "対人" },
    { key: "bargain", label: "値切り", base: 5, category: "対人" },
    { key: "credit_rating", label: "信用", base: 15, category: "対人" },
    // 戦闘
    { key: "fist_punch", label: "こぶし(パンチ)", base: 50, category: "戦闘" },
    { key: "kick", label: "キック", base: 25, category: "戦闘" },
    { key: "grapple", label: "組み付き", base: 25, category: "戦闘" },
    { key: "head_butt", label: "頭突き", base: 10, category: "戦闘" },
    { key: "handgun", label: "拳銃", base: 20, category: "戦闘" },
    { key: "rifle", label: "ライフル", base: 25, category: "戦闘" },
    { key: "shotgun", label: "ショットガン", base: 30, category: "戦闘" },
    { key: "smg", label: "サブマシンガン", base: 15, category: "戦闘" },
    { key: "throw", label: "投擲", base: 25, category: "戦闘" },
    { key: "dodge", label: "回避", base: 0, baseFormula: "DEX*2", category: "戦闘" },
    // 行動・身体
    { key: "hide", label: "隠れる", base: 10, category: "行動" },
    { key: "conceal", label: "隠す", base: 15, category: "行動" },
    { key: "sneak", label: "忍び歩き", base: 10, category: "行動" },
    { key: "climb", label: "登攀", base: 40, category: "行動" },
    { key: "jump", label: "跳躍", base: 25, category: "行動" },
    { key: "swim", label: "水泳", base: 25, category: "行動" },
    { key: "drive_auto", label: "運転(自動車)", base: 20, category: "行動" },
    { key: "ride", label: "乗馬", base: 5, category: "行動" },
    { key: "photography", label: "写真術", base: 10, category: "行動" },
    { key: "disguise", label: "変装", base: 1, category: "行動" },
    { key: "first_aid", label: "応急手当", base: 30, category: "行動" },
    // 技術
    { key: "locksmith", label: "鍵開け", base: 1, category: "技術" },
    { key: "mech_repair", label: "機械修理", base: 20, category: "技術" },
    { key: "elec_repair", label: "電気修理", base: 10, category: "技術" },
    { key: "operate_heavy", label: "重機械操作", base: 1, category: "技術" },
    { key: "pilot", label: "操縦", base: 1, category: "技術" },
    { key: "computer", label: "コンピューター", base: 1, category: "技術" },
    { key: "electronics", label: "電子工学", base: 1, category: "技術" },
    // 知識
    { key: "medicine", label: "医学", base: 5, category: "知識" },
    { key: "psychoanalysis", label: "精神分析", base: 1, category: "知識" },
    { key: "occult", label: "オカルト", base: 5, category: "知識" },
    { key: "accounting", label: "経理", base: 10, category: "知識" },
    { key: "law", label: "法律", base: 5, category: "知識" },
    { key: "history", label: "歴史", base: 20, category: "知識" },
    { key: "archaeology", label: "考古学", base: 1, category: "知識" },
    { key: "anthropology", label: "人類学", base: 1, category: "知識" },
    { key: "natural_history", label: "博物学", base: 10, category: "知識" },
    { key: "chemistry", label: "化学", base: 1, category: "知識" },
    { key: "physics", label: "物理学", base: 1, category: "知識" },
    { key: "biology", label: "生物学", base: 1, category: "知識" },
    { key: "geology", label: "地質学", base: 1, category: "知識" },
    { key: "astronomy", label: "天文学", base: 1, category: "知識" },
    { key: "pharmacy", label: "薬学", base: 1, category: "知識" },
    { key: "art", label: "芸術", base: 5, category: "知識" },
    { key: "craft", label: "製作", base: 5, category: "知識" },
    {
      key: "own_language",
      label: "母国語",
      base: 0,
      baseFormula: "EDU*5",
      category: "知識",
    },
    { key: "other_language", label: "他の言語", base: 1, category: "知識" },
    { key: "cthulhu_mythos", label: "クトゥルフ神話", base: 0, category: "知識" },
  ],
  occupations: OCCUPATIONS_6(),
};

/** 6 版の代表職業群(技能P式 = EDU*20)。説明文は自作。*/
function OCCUPATIONS_6() {
  return [
    occ(
      "antiquarian",
      "古物商",
      "古美術や骨董を扱い来歴と真贋を見極める目利き。古い文物から歴史の裏側に通じる。",
      ["library_use", "history", "art", "spot_hidden", "bargain", "other_language"],
    ),
    occ(
      "author",
      "作家",
      "物語や記事を綴る書き手。取材と想像力で人と世界を描く。",
      ["library_use", "own_language", "other_language", "history", "psychology", "art"],
    ),
    occ(
      "clergy",
      "聖職者",
      "信徒を導き儀式を司る宗教者。教義と人の心に通じる地域の相談役。",
      ["accounting", "library_use", "own_language", "history", "psychology", "persuade"],
    ),
    occ(
      "criminal",
      "犯罪者",
      "法の外で生きる者。盗み・欺き・暴力のいずれかに長け、裏社会の流儀を知る。",
      ["sneak", "hide", "conceal", "locksmith", "fast_talk", "handgun"],
    ),
    occ(
      "dilettante",
      "自由人",
      "資産があり働く必要のない者。社交と趣味に時間を費やし広く教養を備える。",
      ["art", "ride", "other_language", "bargain", "handgun", "persuade"],
    ),
    occ(
      "doctor",
      "医師",
      "病と傷を診る医療の専門家。冷静な観察と確かな手当てで人命に向き合う。",
      ["medicine", "first_aid", "biology", "pharmacy", "psychology", "other_language"],
    ),
    occ(
      "engineer",
      "技師",
      "機械や構造物を設計・整備する技術者。理論と実装で問題を解く。",
      ["mech_repair", "elec_repair", "operate_heavy", "physics", "library_use", "craft"],
    ),
    occ(
      "journalist",
      "記者",
      "事件や人物を取材し記事にする書き手。情報源を辿り隠れた事実を掘り起こす。",
      ["library_use", "own_language", "psychology", "persuade", "spot_hidden", "photography"],
    ),
    occ(
      "detective",
      "私立探偵",
      "依頼を受けて調査・尾行・聞き込みを行う調査員。観察力と人脈で真相へ近づく。",
      ["spot_hidden", "listen", "psychology", "persuade", "library_use", "handgun"],
    ),
    occ(
      "police",
      "警察官",
      "治安を守り事件を捜査する公務員。聞き込みと実力行使の双方に通じる。",
      ["spot_hidden", "listen", "psychology", "fist_punch", "handgun", "first_aid"],
    ),
    occ(
      "professor",
      "大学教授",
      "専門分野を究め学生を導く学者。膨大な知識と資料へのアクセスを持つ。",
      ["library_use", "own_language", "other_language", "history", "psychology", "occult"],
    ),
    occ(
      "soldier",
      "軍人",
      "訓練を積んだ戦闘の専門家。武器の扱いと過酷な状況での生存に長ける。",
      ["fist_punch", "rifle", "first_aid", "sneak", "throw", "dodge"],
    ),
  ];
}

function occ(
  id: string,
  name: string,
  description: string,
  occupationSkills: string[],
) {
  return {
    id,
    name,
    description,
    skillPointsFormula: "EDU*20",
    occupationSkills,
    creditRating: { min: 0, max: 99 },
  };
}

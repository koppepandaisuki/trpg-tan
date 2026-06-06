import type { SystemDefinition } from "../types.js";

/**
 * クトゥルフ神話TRPG 第7版のシステム定義。
 *
 * 数値(能力値レンジ・技能初期値・技能ポイント式・信用点数)はゲームの
 * 仕組み=著作権保護外のため転記。職業の説明文はすべて自作(ルールブックの
 * 文章は転記していない)。技能・職業は主要どころを網羅的に収録。さらに追加
 * したい場合は同じ構造で要素を足すだけでよい。
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
  interestPointsFormula: "INT*2",
  skills: [
    // 探索・知覚
    { key: "spot_hidden", label: "目星", base: 25, category: "探索" },
    { key: "listen", label: "聞き耳", base: 20, category: "探索" },
    { key: "library_use", label: "図書館", base: 20, category: "探索" },
    { key: "navigate", label: "ナビゲート", base: 10, category: "探索" },
    { key: "track", label: "追跡", base: 10, category: "探索" },
    { key: "appraise", label: "鑑定", base: 5, category: "探索" },
    // 対人
    { key: "psychology", label: "心理学", base: 10, category: "対人" },
    { key: "persuade", label: "説得", base: 10, category: "対人" },
    { key: "fast_talk", label: "言いくるめ", base: 5, category: "対人" },
    { key: "charm", label: "魅惑", base: 15, category: "対人" },
    { key: "intimidate", label: "威圧", base: 15, category: "対人" },
    // 戦闘
    { key: "fighting_brawl", label: "近接戦闘(白兵)", base: 25, category: "戦闘" },
    { key: "firearms_handgun", label: "射撃(拳銃)", base: 20, category: "戦闘" },
    {
      key: "firearms_rifle",
      label: "射撃(ライフル/ショットガン)",
      base: 25,
      category: "戦闘",
    },
    { key: "throw", label: "投擲", base: 20, category: "戦闘" },
    { key: "dodge", label: "回避", base: 0, baseFormula: "DEX/2", category: "戦闘" },
    // 行動・身体
    { key: "stealth", label: "隠密", base: 20, category: "行動" },
    { key: "climb", label: "登攀", base: 20, category: "行動" },
    { key: "jump", label: "跳躍", base: 20, category: "行動" },
    { key: "swim", label: "水泳", base: 20, category: "行動" },
    { key: "drive_auto", label: "運転(自動車)", base: 20, category: "行動" },
    { key: "ride", label: "乗馬", base: 5, category: "行動" },
    { key: "sleight_of_hand", label: "手さばき", base: 10, category: "行動" },
    { key: "disguise", label: "変装", base: 5, category: "行動" },
    { key: "first_aid", label: "応急手当", base: 30, category: "行動" },
    // 技術
    { key: "locksmith", label: "鍵開け", base: 1, category: "技術" },
    { key: "mech_repair", label: "機械修理", base: 10, category: "技術" },
    { key: "elec_repair", label: "電気修理", base: 10, category: "技術" },
    {
      key: "operate_heavy",
      label: "重機械操作",
      base: 1,
      category: "技術",
    },
    { key: "pilot", label: "操縦", base: 1, category: "技術" },
    { key: "computer", label: "コンピューター", base: 5, category: "技術" },
    { key: "electronics", label: "電子工学", base: 1, category: "技術" },
    { key: "art_craft", label: "芸術/製作", base: 5, category: "技術" },
    // 知識
    { key: "accounting", label: "経理", base: 5, category: "知識" },
    { key: "anthropology", label: "人類学", base: 1, category: "知識" },
    { key: "archaeology", label: "考古学", base: 1, category: "知識" },
    { key: "history", label: "歴史", base: 5, category: "知識" },
    { key: "law", label: "法律", base: 5, category: "知識" },
    { key: "medicine", label: "医学", base: 1, category: "知識" },
    { key: "natural_world", label: "自然", base: 10, category: "知識" },
    { key: "occult", label: "オカルト", base: 5, category: "知識" },
    { key: "science", label: "科学", base: 1, category: "知識" },
    { key: "psychoanalysis", label: "精神分析", base: 1, category: "知識" },
    { key: "survival", label: "サバイバル", base: 10, category: "知識" },
    {
      key: "own_language",
      label: "母国語",
      base: 0,
      baseFormula: "EDU",
      category: "知識",
    },
    { key: "other_language", label: "他の言語", base: 1, category: "知識" },
    { key: "cthulhu_mythos", label: "クトゥルフ神話", base: 0, category: "知識" },
    { key: "credit_rating", label: "信用", base: 0, category: "知識" },
  ],
  occupations: OCCUPATIONS_7(),
};

/** 7 版の代表職業群。説明文はすべて自作。技能P式・信用点数は転記(数値ルール)。*/
function OCCUPATIONS_7() {
  return [
    occ(
      "antiquarian",
      "古物商",
      "古美術や骨董を扱い、来歴や真贋を見極める目利き。古い文物を通じて歴史の裏側に通じている。",
      "EDU*4",
      [30, 70],
      ["appraise", "library_use", "history", "art_craft", "spot_hidden", "other_language"],
    ),
    occ(
      "author",
      "作家",
      "物語や記事を綴る書き手。取材と想像力で人と世界を描き、言葉で説得する力を持つ。",
      "EDU*4",
      [9, 30],
      ["library_use", "own_language", "other_language", "history", "psychology", "natural_world"],
    ),
    occ(
      "clergy",
      "聖職者",
      "信徒を導き儀式を司る宗教者。教義と人の心に通じ、地域社会の相談役でもある。",
      "EDU*4",
      [9, 60],
      ["accounting", "library_use", "own_language", "history", "psychology", "persuade"],
    ),
    occ(
      "criminal",
      "犯罪者",
      "法の外で生きる者。盗み・欺き・暴力のいずれかに長け、裏社会の流儀を知る。",
      "EDU*2+DEX*2",
      [5, 65],
      ["stealth", "locksmith", "sleight_of_hand", "fast_talk", "spot_hidden", "fighting_brawl"],
    ),
    occ(
      "dilettante",
      "自由人",
      "働く必要のない資産家。趣味と社交に時間を費やし、広く浅く教養を備える。",
      "EDU*2+APP*2",
      [50, 99],
      ["art_craft", "ride", "other_language", "charm", "firearms_handgun", "appraise"],
    ),
    occ(
      "doctor",
      "医師",
      "病と傷を診る医療の専門家。冷静な観察と確かな手当てで人命に向き合う。",
      "EDU*4",
      [30, 80],
      ["medicine", "first_aid", "science", "psychology", "other_language", "persuade"],
    ),
    occ(
      "engineer",
      "技師",
      "機械や構造物を設計・整備する技術者。理論と実装の両面で問題を解く。",
      "EDU*4",
      [30, 60],
      ["mech_repair", "elec_repair", "operate_heavy", "science", "library_use", "art_craft"],
    ),
    occ(
      "entertainer",
      "芸能人",
      "舞台や映像で観客を魅了する表現者。人前での振る舞いと度胸を武器にする。",
      "EDU*2+APP*2",
      [9, 70],
      ["art_craft", "charm", "fast_talk", "psychology", "disguise", "listen"],
    ),
    occ(
      "journalist",
      "記者",
      "事件や人物を取材し記事にする書き手。情報源を辿り、隠された事実を掘り起こす。",
      "EDU*4",
      [9, 30],
      ["library_use", "own_language", "psychology", "persuade", "spot_hidden", "history"],
    ),
    occ(
      "detective",
      "私立探偵",
      "依頼を受けて調査・尾行・聞き込みを行う調査員。観察力と人脈で真相へ近づく。",
      "EDU*2+DEX*2",
      [9, 30],
      ["spot_hidden", "listen", "psychology", "persuade", "library_use", "firearms_handgun"],
    ),
    occ(
      "police",
      "警察官",
      "治安を守り事件を捜査する公務員。聞き込みと実力行使の双方に通じる。",
      "EDU*2+DEX*2",
      [9, 30],
      ["spot_hidden", "listen", "psychology", "fighting_brawl", "firearms_handgun", "first_aid"],
    ),
    occ(
      "professor",
      "大学教授",
      "専門分野を究め学生を導く学者。膨大な知識と資料へのアクセスを持つ。",
      "EDU*4",
      [20, 70],
      ["library_use", "own_language", "other_language", "history", "psychology", "science"],
    ),
    occ(
      "soldier",
      "軍人",
      "訓練を積んだ戦闘の専門家。武器の扱いと過酷な状況での生存術に長ける。",
      "EDU*2+DEX*2",
      [9, 30],
      ["fighting_brawl", "firearms_rifle", "first_aid", "stealth", "survival", "throw"],
    ),
    occ(
      "student",
      "学生",
      "学びの途上にある若者。専門はまだ浅いが、好奇心と柔軟さで未知に挑む。",
      "EDU*4",
      [5, 10],
      ["library_use", "own_language", "other_language", "science", "psychology", "computer"],
    ),
    occ(
      "nurse",
      "看護師",
      "患者の世話と治療補助を担う医療従事者。応急処置と人への気配りに優れる。",
      "EDU*4",
      [9, 30],
      ["first_aid", "medicine", "psychology", "science", "listen", "persuade"],
    ),
    occ(
      "tribe_member",
      "野外活動家",
      "山野や荒野で暮らす術に通じた者。自然を読み、危険な環境を生き抜く。",
      "EDU*2+DEX*2",
      [0, 15],
      ["survival", "natural_world", "track", "climb", "swim", "throw"],
    ),
  ];
}

function occ(
  id: string,
  name: string,
  description: string,
  skillPointsFormula: string,
  cr: [number, number],
  occupationSkills: string[],
) {
  return {
    id,
    name,
    description,
    skillPointsFormula,
    occupationSkills,
    creditRating: { min: cr[0], max: cr[1] },
  };
}

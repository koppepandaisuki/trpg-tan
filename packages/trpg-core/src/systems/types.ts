import type { CoCEdition } from "../dice/coc-check.js";

/**
 * システム定義のスキーマ(定義駆動)。CoC6/7 をはじめ、各 TRPG システムの
 * シートを「データ」として表現する。シート UI はこの定義を読んで描画し、
 * 別システム対応は新しい定義オブジェクトを足すだけにする。
 */

/** 能力値(STR, CON, ...)の定義 */
export interface CharacteristicDef {
  key: string; // "STR"
  label: string; // "筋力"
  /** 能力値生成のダイス記法(例 7e:"3D6*5" は表示用、実生成は別途)*/
  rollHint?: string;
  min?: number;
  max?: number;
}

/**
 * 派生値(HP, MP, SAN, ダメージボーナス等)の定義。
 * formula は能力値キーを参照する式の人間可読表現。実際の算出は
 * システムごとの compute 関数(将来)で行い、ここでは表示と意図を持つ。
 */
export interface DerivedDef {
  key: string; // "HP"
  label: string; // "耐久力"
  formula: string; // "(CON+SIZ)/10" など
}

/** 技能の定義 */
export interface SkillDef {
  key: string; // "spot_hidden"
  label: string; // "目星"
  base: number; // 初期値(%)。固定値の技能はこれを使う
  /**
   * 能力値依存の初期値(任意)。例 7版 回避 "DEX/2"、母国語 "EDU"。
   * 指定時は base より優先し、能力値から算出する(skillBaseValue)。
   */
  baseFormula?: string;
  category?: string; // "探索" 等のグルーピング
}

/**
 * 職業の定義。説明文(description)は著作権配慮で自作した文章を入れる。
 * 技能ポイント式・職業技能・信用点数といった "数値ルール" は保護外のため転記可。
 */
export interface OccupationDef {
  id: string; // "detective"
  name: string; // "探偵"
  /** 自作の説明文(ルールブックの文章は転記しない)*/
  description: string;
  /** 職業技能ポイント式(例 7e:"EDU*4"、6e:"EDU*20")*/
  skillPointsFormula: string;
  /** 職業技能の skill キー一覧 */
  occupationSkills: string[];
  /** 信用点数(クレジットレーティング)の範囲 */
  creditRating: { min: number; max: number };
}

export interface SystemDefinition {
  id: string; // "coc7"
  label: string; // "クトゥルフ神話TRPG(第7版)"
  family: "coc";
  edition: CoCEdition;
  characteristics: CharacteristicDef[];
  derived: DerivedDef[];
  skills: SkillDef[];
  occupations: OccupationDef[];
  /** 興味技能ポイント式(例 7e:"INT*2"、6e:"INT*10")*/
  interestPointsFormula: string;
}

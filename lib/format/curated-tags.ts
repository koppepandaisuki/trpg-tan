/**
 * キュレーション探索タグ(編集部が選ぶ「テーマで探す」タグ)。
 *
 * 既存の自由記述タグ(product_tags / ?tag=...)の上に「正規の語彙」を被せる
 * 仕組み。クリエイターがバラバラの表記(例: 初心者OK / 初心者向け / ビギナー)
 * を使うと探索の入口がぼやけるので、ここで定義した語を:
 *   1. ストアの「テーマで探す」レールに並べる(クリックで ?tag=... 検索)
 *   2. ビルダーのタグ入力で「おすすめの探索タグ」として提示する
 * の両方で使い、表記を揃える。
 *
 * 重要な制約:
 *   - DB は tag を小文字で保存する(CHECK: tag = lower(tag)、validator も
 *     s === s.toLowerCase() を要求)。日本語は小文字化の影響を受けないので、
 *     `tag`(保存・URL に使う正規値)は日本語主体にして安全側に倒す。
 *   - 表示用の `label`(「GMしやすい」等の整形名)は `tag` と分離する。
 *     これで保存値はクリーンなまま、UI では読みやすい名前を出せる。
 */

export type CuratedTagGroupId = "play" | "time" | "players" | "mood";

export interface CuratedTagGroup {
  id: CuratedTagGroupId;
  /** レールの小見出し。 */
  label: string;
}

export interface CuratedTag {
  /** 保存・URL(?tag=)に使う正規値。日本語のみ(小文字制約に抵触しない)。 */
  tag: string;
  /** UI 表示名(整形可。ラテン大文字や記号を含んでよい)。 */
  label: string;
  /** チップの説明(title 属性 / 補足表示)。 */
  description: string;
  group: CuratedTagGroupId;
}

export const CURATED_TAG_GROUPS: CuratedTagGroup[] = [
  { id: "play", label: "あそびやすさ" },
  { id: "time", label: "プレイ時間" },
  { id: "players", label: "人数" },
  { id: "mood", label: "雰囲気・ジャンル" },
];

/**
 * 正規の探索タグ一覧。`tag` は日本語のみ(小文字化で不変)・30 文字以内に保つ。
 * 並び順がそのままレール内の表示順になる。
 */
export const CURATED_TAGS: CuratedTag[] = [
  // ----- あそびやすさ -----
  {
    tag: "初心者におすすめ",
    label: "初心者におすすめ",
    description: "ルールを知らなくても遊びやすい入門向け",
    group: "play",
  },
  {
    tag: "回しやすい",
    label: "GMしやすい",
    description: "はじめてGM(進行役)をする人でも進めやすい",
    group: "play",
  },
  {
    tag: "ルール簡単",
    label: "ルール簡単",
    description: "判定がシンプルで覚えることが少ない",
    group: "play",
  },
  // ----- プレイ時間 -----
  {
    tag: "短時間",
    label: "短時間（〜2時間）",
    description: "サクッと遊べる短時間セッション",
    group: "time",
  },
  {
    tag: "単発",
    label: "単発・1話完結",
    description: "続きものではなく1回で完結する",
    group: "time",
  },
  {
    tag: "長編",
    label: "長編・キャンペーン",
    description: "じっくり遊ぶ連続シナリオ",
    group: "time",
  },
  // ----- 人数 -----
  {
    tag: "ソロ",
    label: "ソロ・1人用",
    description: "1人でも遊べる",
    group: "players",
  },
  {
    tag: "タイマン",
    label: "タイマン（2人）",
    description: "GMとPL1人で遊べる",
    group: "players",
  },
  {
    tag: "大人数向け",
    label: "大人数向け",
    description: "4人以上でわいわい遊べる",
    group: "players",
  },
  // ----- 雰囲気・ジャンル -----
  {
    tag: "ホラー",
    label: "ホラー",
    description: "怖さ・緊張感のあるシナリオ",
    group: "mood",
  },
  {
    tag: "戦闘重視",
    label: "戦闘重視",
    description: "バトル・戦術が見どころ",
    group: "mood",
  },
  {
    tag: "探索重視",
    label: "探索・調査",
    description: "謎解き・情報収集が中心",
    group: "mood",
  },
  {
    tag: "ほのぼの",
    label: "ほのぼの・日常",
    description: "ほっこり穏やかな雰囲気",
    group: "mood",
  },
  {
    tag: "シリアス",
    label: "シリアス",
    description: "重厚・本格派のストーリー",
    group: "mood",
  },
];

/** 正規タグ値から定義を引く(レールの active 判定・ラベル解決に使う)。 */
export function findCuratedTag(tag: string | null | undefined): CuratedTag | undefined {
  if (!tag) return undefined;
  return CURATED_TAGS.find((t) => t.tag === tag);
}

/** グループ単位で取り出す(レール / ピッカーの描画用)。 */
export function curatedTagsByGroup(group: CuratedTagGroupId): CuratedTag[] {
  return CURATED_TAGS.filter((t) => t.group === group);
}

/**
 * BuilderForm の「対応システム」を自由記入から選択式に変更するための
 * 主要 TRPG システム一覧。
 *
 * 順序は α 期間の想定流入順(クトゥルフ系が国内でほぼ最大、続いて
 * 海外系・国産マイナー系)。新しいシステムを追加する場合は、対応する
 * シナリオが発生したタイミングで適宜追加。
 *
 * 「その他」を選ぶと自由入力できる(従来の自由記入と同等)。これにより
 * マイナーシステムも投稿可能。
 *
 * DB スキーマは text 列のままなので、選択肢の変更は UI 側のみ。
 * 既存のレコードに対しても、value が TRPG_SYSTEMS に含まれない場合は
 * 自動的に「その他」+ 既存値の表示モードになる(BuilderForm 側で判定)。
 */
export const TRPG_SYSTEMS = [
  "クトゥルフ神話TRPG(第7版)",
  "新クトゥルフ神話TRPG",
  "クトゥルフ神話TRPG(第6版)",
  "D&D 5e",
  "パスファインダー2版",
  "ソード・ワールド 2.5",
  "シノビガミ",
  "ダブルクロス The 3rd Edition",
  "インセイン",
  "サタスペ",
  "獸ノ森",
  "マルチジャンル・ホラーRPG インセイン",
  "ストリテラ オープニング・チャプター",
  "クトゥルフ神話TRPG(その他)",
] as const;

/**
 * 「その他」を示す sentinel value。select の <option value> に使い、
 * 実際の systemLabel フィールドには反映しない(custom input の値が
 * フィールドに入る)。
 */
export const OTHER_SYSTEM_SENTINEL = "__other__" as const;

/**
 * 既存の systemLabel(任意の string)が選択肢に含まれているかを判定。
 * Edit モードで既存レコードを読み込んだとき、選択肢にない値を
 * 「その他」+ 入力欄で表示するために使う。
 */
export function isKnownSystem(value: string | undefined | null): boolean {
  if (!value) return false;
  return (TRPG_SYSTEMS as readonly string[]).includes(value);
}

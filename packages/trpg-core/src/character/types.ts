/**
 * キャラクターシートの永続化スキーマ。これを JSON 直列化したものが
 * `.ccsheet` ファイルの中身になる(1 キャラ = 1 ファイル)。
 *
 * 互換性のため schemaVersion を持つ。将来フィールドを増やすときは
 * マイグレーション関数で旧バージョンを引き上げる。
 */

export const CCSHEET_SCHEMA_VERSION = 1 as const;

export interface CharacterSheet {
  schemaVersion: typeof CCSHEET_SCHEMA_VERSION;
  /** 一意 ID(UUID 想定)*/
  id: string;
  /** 対象システム定義の id(例 "coc7" / "coc6")*/
  systemId: string;
  /** 探索者名 */
  name: string;
  /** ポートレート画像の参照(アプリ相対パス or data URL)。未設定可 */
  image?: string | null;
  /** 能力値: キー(STR 等)→ 値 */
  characteristics: Record<string, number>;
  /** 技能: キー → 割り振り後の最終値(%)。未設定技能は base 扱い。
   *  PLAY 等の消費側はこの最終値を見ればよい。 */
  skills: Record<string, number>;
  /** 選択した職業 id(未選択可)。オリジナル職業のときは null + occupationName。*/
  occupationId?: string | null;
  /** オリジナル(自由記入)職業名。occupationId が無くこれがある＝独自職業。*/
  occupationName?: string | null;
  /**
   * 編集状態の復元用(任意): 職業/興味ポイントの割り振り内訳。
   * skills(最終値)とは別に保持し、再編集時にプール内訳を復元できる。
   */
  allocation?: {
    occupation: Record<string, number>;
    interest: Record<string, number>;
  };
  /** 任意メモ */
  notes?: string;
  meta: {
    createdAt: string; // ISO
    updatedAt: string; // ISO
  };
}

/**
 * 空のシートを生成する(新規作成時の雛形)。id / 日時は呼び出し側で与える
 * (環境非依存に保つため crypto / Date を内部で呼ばない)。
 */
export function createEmptySheet(params: {
  id: string;
  systemId: string;
  now: string;
  name?: string;
}): CharacterSheet {
  return {
    schemaVersion: CCSHEET_SCHEMA_VERSION,
    id: params.id,
    systemId: params.systemId,
    name: params.name ?? "",
    image: null,
    characteristics: {},
    skills: {},
    occupationId: null,
    notes: "",
    meta: { createdAt: params.now, updatedAt: params.now },
  };
}

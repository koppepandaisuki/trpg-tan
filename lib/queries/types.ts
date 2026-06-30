/**
 * Provisional TS types for query results.
 *
 * `types/database.ts` is not generated yet (Supabase project pending).
 * Once `supabase gen types typescript` is available, this file should be
 * replaced by mapping over the generated Database type.
 *
 * Phase 4 only needs the public-facing shapes. Internal columns like
 * file_path are intentionally NOT in ProductDetail — the query layer
 * does not even SELECT them, so they cannot leak into the UI.
 */

export type ProductType =
  | "full_package"
  | "scenario"
  | "rulebook"
  | "character_art"
  | "map"
  | "bgm_audio";

export type FileFormat = "pdf" | "image_zip" | "audio" | "pack";

/**
 * 商品カード / hero に Steam 風の総合評価 Badge を表示するための
 * 軽量サマリ。`null` のときは「評価なし」相当で UI 側は非表示にする。
 */
export type ProductReviewSummary = {
  total: number;
  positive: number;
  /** 平均星(1–5)。レビュー 0 件のときは 0。*/
  avgStars: number;
  /** ReviewLabel と一致(型循環を避けるため string で持つ)*/
  label: string;
};

export type ProductListItem = {
  id: string;
  slug: string;
  title: string;
  productType: ProductType;
  priceJpy: number;
  /** 割引率(0..100)。100 = 無料配布。実効価格は salePriceJpy() で算出。*/
  discountPercent: number;
  /** セール開始/終了(ISO)。null は無期限。期間内のみ割引が有効。*/
  discountStartsAt: string | null;
  discountEndsAt: string | null;
  coverPath: string | null;
  systemLabel: string | null;
  publishedAt: string;
  creator: {
    id: string;
    displayName: string;
    /**
     * 商品カード等でクリエイターアバターを表示するために path を露出。
     * 既存呼び出しが `avatarPath: null` で取得していない場合は null で
     * 安全側に倒す。
     */
    avatarPath: string | null;
  };
  /** 集計済の評価サマリ。集計しないクエリでは null。*/
  reviewSummary?: ProductReviewSummary | null;
};

export type ProductDetail = {
  id: string;
  slug: string;
  title: string;
  description: string;
  productType: ProductType;
  fileFormat: FileFormat;
  priceJpy: number;
  /** 割引率(0..100)。100 = 無料配布。実効価格は salePriceJpy() で算出。*/
  discountPercent: number;
  /** セール開始/終了(ISO)。null は無期限。期間内のみ割引が有効。*/
  discountStartsAt: string | null;
  discountEndsAt: string | null;
  coverPath: string | null;
  systemLabel: string | null;
  players: string | null;
  playtime: string | null;
  recommendedSkills: string | null;
  allowCommercial: boolean;
  allowRedistribution: boolean;
  publishedAt: string;
  updatedAt: string;
  tags: string[];
  creator: {
    id: string;
    displayName: string;
    avatarPath: string | null;
    bio: string;
  };
};

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
  | "scenario"
  | "rulebook"
  | "character_art"
  | "map"
  | "bgm_audio";

export type FileFormat = "pdf" | "image_zip" | "audio";

export type ProductListItem = {
  id: string;
  slug: string;
  title: string;
  productType: ProductType;
  priceJpy: number;
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
};

export type ProductDetail = {
  id: string;
  slug: string;
  title: string;
  description: string;
  productType: ProductType;
  fileFormat: FileFormat;
  priceJpy: number;
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

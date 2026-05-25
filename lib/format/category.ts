import type { ProductType, FileFormat } from "@/lib/queries/types";

export const PRODUCT_TYPE_LABEL: Record<ProductType, string> = {
  scenario: "シナリオ",
  rulebook: "ルールブック",
  character_art: "キャラクターイラスト",
  map: "マップ",
  bgm_audio: "BGM・音声",
};

/**
 * Categories shown in the store tabs. `null` represents "all categories".
 * Order matches the design reference (画像3 のタブ並び)。
 */
export const STORE_CATEGORIES: Array<{ value: ProductType | null; label: string }> = [
  { value: null, label: "すべて" },
  { value: "scenario", label: "シナリオ" },
  { value: "rulebook", label: "ルールブック" },
  { value: "map", label: "マップ・バトルマップ" },
  { value: "character_art", label: "アートワーク" },
  { value: "bgm_audio", label: "BGM・効果音" },
];

export function categoryLabel(type: ProductType): string {
  return PRODUCT_TYPE_LABEL[type] ?? type;
}

export const FILE_FORMAT_LABEL: Record<FileFormat, string> = {
  pdf: "PDF",
  image_zip: "画像ZIP",
  audio: "音声(MP3/WAV)",
};

export function fileFormatLabel(format: FileFormat): string {
  return FILE_FORMAT_LABEL[format] ?? format;
}

/**
 * Validate a user-supplied category string against the known enum.
 * Anything else (typos, "all", etc.) collapses to null = no filter.
 */
export function parseCategoryParam(value: string | undefined): ProductType | null {
  if (!value) return null;
  if (value in PRODUCT_TYPE_LABEL) return value as ProductType;
  return null;
}

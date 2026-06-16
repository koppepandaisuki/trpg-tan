import { supabase } from "./supabase";

/**
 * 購入済み作品(リモート・ライブラリ)の取得。
 *
 * Web の lib/queries/library.ts と同じロジックをデスクトップに移植。
 * 認証済みの supabase-js クライアント(ユーザーの JWT を保持)で叩くため、
 * RLS(purchases_select_own / products_select_published|_own)がそのまま効く。
 *
 * 安全性:
 *   - file_path は hasFile(boolean)を計算するためだけに取得し、戻り値には
 *     含めない(Storage キーを UI に漏らさない)。実 DL はスライス3の
 *     Bearer DL API が productId からサーバ側で解決する。
 *   - covers は公開バケットなので getPublicUrl で URL 化できる。
 */

export type RemoteProductType =
  | "full_package"
  | "scenario"
  | "rulebook"
  | "character_art"
  | "map"
  | "bgm_audio";
export type RemoteFileFormat = "pdf" | "image_zip" | "audio" | "pack";
export type RemoteProductStatus = "draft" | "published" | "suspended" | string;
export type LibraryAvailability =
  | "available"
  | "no_file"
  | "suspended"
  | "blocked";

export type RemoteLibraryItem = {
  purchaseId: string;
  productId: string;
  slug: string;
  title: string;
  productType: RemoteProductType;
  fileFormat: RemoteFileFormat;
  productStatus: RemoteProductStatus;
  coverUrl: string | null;
  amountJpy: number;
  currency: string;
  paidAt: string;
  hasFile: boolean;
  availability: LibraryAvailability;
  creator: { id: string; displayName: string };
};

export async function fetchMyLibrary(
  userId: string,
): Promise<RemoteLibraryItem[]> {
  // 1. 自分の paid 購入。
  const { data: purchases, error: purErr } = await supabase
    .from("purchases")
    .select("id, product_id, amount_jpy, currency, paid_at, status")
    .eq("user_id", userId)
    .eq("status", "paid")
    .order("paid_at", { ascending: false });
  if (purErr) throw new Error(purErr.message);
  if (!purchases || purchases.length === 0) return [];

  // 2. 購入した作品。RLS により「published か自分の作品」のみ読める。
  //    他者が配布停止した作品は読めないので、その行は購入情報のみで
  //    プレースホルダ表示する(Web と同じ割り切り)。
  const productIds = Array.from(new Set(purchases.map((p) => p.product_id)));
  const { data: products, error: prodErr } = await supabase
    .from("products")
    .select(
      "id, slug, title, product_type, file_format, status, cover_path, file_path, creator_id",
    )
    .in("id", productIds);
  if (prodErr) throw new Error(prodErr.message);
  const productMap = new Map((products ?? []).map((p) => [p.id, p]));

  // 3. 作者の公開プロフィールを一括取得。
  const creatorIds = Array.from(
    new Set((products ?? []).map((p) => p.creator_id).filter(Boolean)),
  );
  const creatorMap = new Map<string, { id: string; displayName: string }>();
  if (creatorIds.length > 0) {
    const { data: creators } = await supabase
      .from("public_profiles")
      .select("id, display_name")
      .in("id", creatorIds);
    for (const c of creators ?? []) {
      creatorMap.set(c.id, { id: c.id, displayName: c.display_name ?? "" });
    }
  }

  // 4. 公開用アイテムを組み立てる。file_path はここで boolean に畳んで破棄。
  return purchases.map<RemoteLibraryItem>((purchase) => {
    const product = productMap.get(purchase.product_id);
    if (!product) {
      // RLS でブロック(他者が配布停止した作品など)。最小プレースホルダ。
      return {
        purchaseId: purchase.id,
        productId: purchase.product_id,
        slug: "",
        title: "(配布停止中の作品)",
        productType: "scenario",
        fileFormat: "pdf",
        productStatus: "suspended",
        coverUrl: null,
        amountJpy: purchase.amount_jpy,
        currency: purchase.currency,
        paidAt: purchase.paid_at,
        hasFile: false,
        availability: "suspended",
        creator: { id: "", displayName: "" },
      };
    }

    const productStatus = product.status as RemoteProductStatus;
    const hasFile = !!product.file_path;
    const availability: LibraryAvailability =
      productStatus === "suspended"
        ? "suspended"
        : productStatus !== "published"
          ? "blocked"
          : !hasFile
            ? "no_file"
            : "available";

    const coverUrl = product.cover_path
      ? supabase.storage.from("covers").getPublicUrl(product.cover_path).data
          .publicUrl
      : null;

    return {
      purchaseId: purchase.id,
      productId: product.id,
      slug: product.slug,
      title: product.title,
      productType: product.product_type as RemoteProductType,
      fileFormat: product.file_format as RemoteFileFormat,
      productStatus,
      coverUrl,
      amountJpy: purchase.amount_jpy,
      currency: purchase.currency,
      paidAt: purchase.paid_at,
      hasFile,
      availability,
      creator: creatorMap.get(product.creator_id) ?? {
        id: product.creator_id,
        displayName: "",
      },
    };
  });
}

/** 種別ラベル(日本語)。 */
export const PRODUCT_TYPE_LABEL: Record<string, string> = {
  full_package: "フルパッケージ",
  scenario: "シナリオ",
  rulebook: "ルールブック",
  character_art: "キャラ素材",
  map: "マップ",
  bgm_audio: "BGM/音声",
};

/** ファイル形式ラベル。 */
export const FILE_FORMAT_LABEL: Record<string, string> = {
  pdf: "PDF",
  image_zip: "画像ZIP",
  audio: "音声",
  pack: "フルパッケージ(.paradice)",
};

/** 配布状態の短いラベル(available 以外で表示)。 */
export const AVAILABILITY_LABEL: Record<LibraryAvailability, string> = {
  available: "",
  no_file: "ファイル準備中",
  suspended: "配布停止",
  blocked: "閲覧不可",
};

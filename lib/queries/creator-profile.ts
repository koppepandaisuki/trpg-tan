import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ProductListItem, ProductType } from "./types";

/**
 * 他人の creator プロフィール表示用クエリ。
 *
 * クリエイター(public_profiles の 1 行)+ そのクリエイターの公開作品
 * 全件をまとめて取る。public ルート(認証不要)で使うため、RLS は
 * 「public_profiles は全員参照可」「products は status='published' のみ」
 * を前提にしている。
 *
 * Note:
 *  - 作品は LIST 用の slim 列のみ select(file_path / description は不要)
 *  - 並び順は published_at desc(新しい作品が上)
 *  - 作品が 0 件でも profile は返す(新規 creator の歓迎用)
 *  - id が存在しない / 非公開ユーザー → null を返す
 */

export interface CreatorProfileView {
  id: string;
  displayName: string;
  avatarPath: string | null;
  bio: string;
  twitterHandle: string;
  websiteUrl: string;
  products: ProductListItem[];
}

export async function getCreatorProfile(
  id: string,
): Promise<CreatorProfileView | null> {
  const supabase = createClient();

  // Profile 取得
  const { data: profileRow, error: profileErr } = await supabase
    .from("public_profiles")
    .select(
      "id, display_name, avatar_path, bio, twitter_handle, website_url",
    )
    .eq("id", id)
    .maybeSingle();

  if (profileErr) {
    console.error("[getCreatorProfile] profile fetch failed", profileErr);
    return null;
  }
  if (!profileRow) return null;

  // 公開作品の取得(同一クリエイターの published のみ)
  const { data: productRows, error: productsErr } = await supabase
    .from("products")
    .select(
      "id, slug, title, product_type, price_jpy, cover_path, system_label, published_at",
    )
    .eq("creator_id", id)
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (productsErr) {
    console.error("[getCreatorProfile] products fetch failed", productsErr);
    // profile はあるので products 空で返す(部分表示)
    return {
      id: profileRow.id,
      displayName: profileRow.display_name ?? "",
      avatarPath: profileRow.avatar_path,
      bio: profileRow.bio ?? "",
      twitterHandle: profileRow.twitter_handle ?? "",
      websiteUrl: profileRow.website_url ?? "",
      products: [],
    };
  }

  const displayName = profileRow.display_name ?? "";

  const products: ProductListItem[] = (productRows ?? []).map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    productType: r.product_type as ProductType,
    priceJpy: r.price_jpy,
    coverPath: r.cover_path,
    systemLabel: r.system_label,
    publishedAt: r.published_at,
    creator: {
      id: profileRow.id,
      displayName,
    },
  }));

  return {
    id: profileRow.id,
    displayName,
    avatarPath: profileRow.avatar_path,
    bio: profileRow.bio ?? "",
    twitterHandle: profileRow.twitter_handle ?? "",
    websiteUrl: profileRow.website_url ?? "",
    products,
  };
}

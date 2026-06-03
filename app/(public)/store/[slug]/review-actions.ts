"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/session/require";
import { isAlreadyPurchased } from "@/lib/access/purchase-access";
import {
  reviewSubmitSchema,
  type ReviewSubmitInput,
} from "@/lib/validators/review";

/**
 * 自分のレビューを「投稿 or 上書き」する Server Action(Steam ライク)。
 *
 * 条件:
 *   - 認証必須(requireUser)
 *   - 購入済み(paid)であること(isAlreadyPurchased で確認)
 *   - rating は positive / negative のみ(zod 検証)
 *   - comment は 2000 字以下
 *
 * 既存レビューがあれば update、なければ insert。Supabase の upsert を
 * onConflict (product_id, user_id) で使用。
 *
 * 成功時に商品詳細(/store/[slug])を revalidate。
 */
export async function submitReviewAction(
  productId: string,
  productSlug: string,
  raw: ReviewSubmitInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();

  const parsed = reviewSubmitSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "入力に誤りがあります",
    };
  }

  // 購入済みチェック(RLS でも防がれるが、エラーメッセージを丁寧にするため
  // server 側で先に確認)
  const purchased = await isAlreadyPurchased(user.id, productId);
  if (!purchased) {
    return {
      ok: false,
      error: "レビューを投稿するには、この作品を購入する必要があります。",
    };
  }

  const supabase = createClient();
  const { error } = await supabase.from("product_reviews").upsert(
    {
      product_id: productId,
      user_id: user.id,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
    },
    { onConflict: "product_id,user_id" },
  );

  if (error) {
    console.error("[submitReviewAction] upsert failed", error);
    return {
      ok: false,
      error: "レビューの保存に失敗しました。少し時間をおいて再度お試しください。",
    };
  }

  revalidatePath(`/store/${productSlug}`);
  return { ok: true };
}

/**
 * 自分のレビューを削除。
 */
export async function deleteReviewAction(
  productId: string,
  productSlug: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const supabase = createClient();

  const { error } = await supabase
    .from("product_reviews")
    .delete()
    .eq("product_id", productId)
    .eq("user_id", user.id);

  if (error) {
    console.error("[deleteReviewAction] failed", error);
    return { ok: false, error: "削除に失敗しました" };
  }

  revalidatePath(`/store/${productSlug}`);
  return { ok: true };
}

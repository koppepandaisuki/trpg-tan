"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/session/require";
import { isAlreadyPurchased } from "@/lib/access/purchase-access";
import {
  reviewSubmitSchema,
  reviewReplySchema,
  type ReviewSubmitInput,
  type ReviewReplyInput,
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

/**
 * creator がレビューに返信(NNNN)。Steam の Developer's Response 相当。
 *
 * - 認証必須(requireUser)
 * - creator は自分の商品のレビューにだけ返信可能(RLS で担保 + server で
 *   reviewId → product → creator_id を確認して 403 を返す)
 * - 既存返信があれば上書き(upsert with onConflict review_id)
 * - 本文は zod で max 2000 字
 *
 * 成功時に商品詳細ページを revalidate。
 */
export async function submitReplyAction(
  reviewId: string,
  productSlug: string,
  raw: ReviewReplyInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();

  const parsed = reviewReplySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "入力に誤りがあります",
    };
  }

  const supabase = createClient();

  // creator 確認: reviewId → product_id → products.creator_id
  const { data: review, error: reviewErr } = await supabase
    .from("product_reviews")
    .select("id, product_id")
    .eq("id", reviewId)
    .maybeSingle();
  if (reviewErr || !review) {
    return { ok: false, error: "レビューが見つかりません" };
  }
  const { data: prod, error: prodErr } = await supabase
    .from("products")
    .select("creator_id")
    .eq("id", review.product_id)
    .maybeSingle();
  if (prodErr || !prod) {
    return { ok: false, error: "商品が見つかりません" };
  }
  if (prod.creator_id !== user.id) {
    return {
      ok: false,
      error: "このレビューに返信できるのは作品の作者のみです。",
    };
  }

  const { error } = await supabase.from("review_replies").upsert(
    {
      review_id: reviewId,
      creator_id: user.id,
      body: parsed.data.body,
    },
    { onConflict: "review_id" },
  );

  if (error) {
    console.error("[submitReplyAction] upsert failed", error);
    return {
      ok: false,
      error: "返信の保存に失敗しました。少し時間をおいて再度お試しください。",
    };
  }

  revalidatePath(`/store/${productSlug}`);
  return { ok: true };
}

/**
 * 自分の返信を削除。
 */
export async function deleteReplyAction(
  reviewId: string,
  productSlug: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const supabase = createClient();

  const { error } = await supabase
    .from("review_replies")
    .delete()
    .eq("review_id", reviewId)
    .eq("creator_id", user.id);

  if (error) {
    console.error("[deleteReplyAction] failed", error);
    return { ok: false, error: "削除に失敗しました" };
  }

  revalidatePath(`/store/${productSlug}`);
  return { ok: true };
}

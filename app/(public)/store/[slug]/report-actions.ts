"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/session/require";
import { reportSubmitSchema, type ReportSubmitInput } from "@/lib/validators/report";

/**
 * 作品を通報する Server Action。
 *
 * 条件:
 *   - 認証必須(requireUser)。誰でも(購入していなくても)通報できる。
 *   - category / reason は zod 検証(DB CHECK と一致)。
 *
 * 同一ユーザーが同じ作品を二重通報できないよう、DB に
 * unique(product_id, reporter_id) を張ってある。重複時は丁寧な
 * メッセージを返す(成功扱いにはしない)。
 */
export async function reportProductAction(
  productId: string,
  raw: ReportSubmitInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();

  const parsed = reportSubmitSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "入力に誤りがあります",
    };
  }

  const supabase = createClient();
  const { error } = await supabase.from("product_reports").insert({
    product_id: productId,
    reporter_id: user.id,
    category: parsed.data.category,
    reason: parsed.data.reason,
  });

  if (error) {
    // 23505 = unique_violation(同じ作品を既に通報済み)
    if (error.code === "23505") {
      return {
        ok: false,
        error: "この作品はすでに通報済みです。ご協力ありがとうございます。",
      };
    }
    console.error("[reportProductAction] insert failed", error);
    return {
      ok: false,
      error: "通報の送信に失敗しました。時間をおいて再度お試しください。",
    };
  }

  return { ok: true };
}

/**
 * レビュー(本文)を通報する Server Action。作品通報と同じ枠組み。
 * 認証必須。unique(review_id, reporter_id) で二重通報を防ぐ。
 */
export async function reportReviewAction(
  reviewId: string,
  raw: ReportSubmitInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();

  const parsed = reportSubmitSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "入力に誤りがあります",
    };
  }

  const supabase = createClient();
  const { error } = await supabase.from("review_reports").insert({
    review_id: reviewId,
    reporter_id: user.id,
    category: parsed.data.category,
    reason: parsed.data.reason,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error: "このレビューはすでに通報済みです。ご協力ありがとうございます。",
      };
    }
    console.error("[reportReviewAction] insert failed", error);
    return {
      ok: false,
      error: "通報の送信に失敗しました。時間をおいて再度お試しください。",
    };
  }

  return { ok: true };
}

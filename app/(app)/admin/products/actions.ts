"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session/require";
import {
  setProductStatus,
  reviewProduct,
  AdminRpcError,
} from "@/lib/mutations/admin";
import { notifyReviewDecision } from "@/lib/notify/review-notification";
import type { ProductStatus } from "@/lib/format/status";

export type AdminActionResult = { ok: true } | { ok: false; message: string };

const ALLOWED: ProductStatus[] = ["draft", "pending", "published", "suspended"];

export async function setProductStatusAction(
  productId: string,
  newStatus: ProductStatus,
): Promise<AdminActionResult> {
  await requireAdmin();
  if (!ALLOWED.includes(newStatus)) {
    return { ok: false, message: "無効なステータスです" };
  }
  try {
    await setProductStatus(productId, newStatus);
    revalidatePath("/admin/products");
    revalidatePath("/store");
    return { ok: true };
  } catch (e) {
    if (e instanceof AdminRpcError) return { ok: false, message: e.message };
    console.error("[admin/products action] unexpected", e);
    return { ok: false, message: "操作に失敗しました" };
  }
}

/**
 * 審査キューの承認 / 却下。approve=true で公開、false で却下(理由は note)。
 */
export async function reviewProductAction(
  productId: string,
  approve: boolean,
  note?: string,
): Promise<AdminActionResult> {
  await requireAdmin();
  const trimmed = (note ?? "").trim().slice(0, 1000);
  if (!approve && trimmed.length === 0) {
    return { ok: false, message: "却下の理由を入力してください" };
  }
  try {
    await reviewProduct(productId, approve, trimmed || undefined);
    // クリエイターへ結果をメール通知(未設定なら no-op、失敗しても続行)。
    await notifyReviewDecision({ productId, approve, note: trimmed || undefined });
    revalidatePath("/admin/products");
    revalidatePath("/store");
    return { ok: true };
  } catch (e) {
    if (e instanceof AdminRpcError) return { ok: false, message: e.message };
    console.error("[admin/products review] unexpected", e);
    return { ok: false, message: "操作に失敗しました" };
  }
}

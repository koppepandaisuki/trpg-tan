"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session/require";
import { createClient } from "@/lib/supabase/server";
import {
  setProductStatus,
  deleteReview,
  AdminRpcError,
} from "@/lib/mutations/admin";
import { notifySuspension } from "@/lib/notify/review-notification";
import { reportStatusSchema, type ReportStatus } from "@/lib/validators/report";

export type AdminActionResult = { ok: true } | { ok: false; message: string };

/**
 * 通報の処理状態を更新する(open → reviewed / dismissed)。
 *
 * admin 限定。product_reports の RLS(product_reports_update_admin)が
 * is_admin() を要求するので、通常クライアントの update で十分。
 */
export async function resolveReportAction(
  reportId: string,
  newStatus: ReportStatus,
): Promise<AdminActionResult> {
  await requireAdmin();

  const parsed = reportStatusSchema.safeParse(newStatus);
  if (!parsed.success || parsed.data === "open") {
    return { ok: false, message: "無効な状態です" };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("product_reports")
    .update({ status: parsed.data })
    .eq("id", reportId);

  if (error) {
    console.error("[resolveReportAction] failed", error);
    return { ok: false, message: "更新に失敗しました" };
  }

  revalidatePath("/admin/reports");
  return { ok: true };
}

/**
 * 通報から作品を直接「公開停止」する(takedown ループの要)。
 *
 *   1. 通報対象の作品を suspended にする(admin RPC)。
 *   2. その作品に対する open な通報をすべて reviewed にする(キュー掃除)。
 *   3. クリエイターへ停止を通報理由つきでメール通知。
 *
 * admin 限定。通報が見つからなければエラー。
 */
export async function suspendFromReportAction(
  reportId: string,
): Promise<AdminActionResult> {
  await requireAdmin();
  const supabase = createClient();

  const { data: report, error: readErr } = await supabase
    .from("product_reports")
    .select("product_id, reason")
    .eq("id", reportId)
    .maybeSingle();
  if (readErr || !report) {
    return { ok: false, message: "通報が見つかりませんでした" };
  }

  try {
    await setProductStatus(report.product_id, "suspended");
  } catch (e) {
    if (e instanceof AdminRpcError) return { ok: false, message: e.message };
    console.error("[suspendFromReportAction] suspend failed", e);
    return { ok: false, message: "停止に失敗しました" };
  }

  // 同じ作品の open 通報をまとめて対応済みにする。
  const { error: resolveErr } = await supabase
    .from("product_reports")
    .update({ status: "reviewed" })
    .eq("product_id", report.product_id)
    .eq("status", "open");
  if (resolveErr) {
    console.error("[suspendFromReportAction] resolve failed", resolveErr);
  }

  // 通報理由をつけてクリエイターへ通知(未設定なら no-op)。
  await notifySuspension({
    productId: report.product_id,
    reason: report.reason,
  });

  revalidatePath("/admin/reports");
  revalidatePath("/admin/products");
  revalidatePath("/store");
  return { ok: true };
}

/**
 * レビュー通報の処理状態を更新(open → reviewed / dismissed)。
 * review_reports の RLS(review_reports_update_admin)が is_admin() を要求。
 */
export async function resolveReviewReportAction(
  reportId: string,
  newStatus: ReportStatus,
): Promise<AdminActionResult> {
  await requireAdmin();

  const parsed = reportStatusSchema.safeParse(newStatus);
  if (!parsed.success || parsed.data === "open") {
    return { ok: false, message: "無効な状態です" };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("review_reports")
    .update({ status: parsed.data })
    .eq("id", reportId);

  if (error) {
    console.error("[resolveReviewReportAction] failed", error);
    return { ok: false, message: "更新に失敗しました" };
  }

  revalidatePath("/admin/reports");
  return { ok: true };
}

/**
 * 通報されたレビューを削除する(モデレーション)。admin_delete_review RPC で
 * レビューを消すと、cascade で当該 review_reports もキューから消える。
 */
export async function deleteReviewFromReportAction(
  reviewId: string,
): Promise<AdminActionResult> {
  await requireAdmin();
  try {
    await deleteReview(reviewId);
  } catch (e) {
    if (e instanceof AdminRpcError) return { ok: false, message: e.message };
    console.error("[deleteReviewFromReportAction] failed", e);
    return { ok: false, message: "削除に失敗しました" };
  }
  revalidatePath("/admin/reports");
  revalidatePath("/store");
  return { ok: true };
}

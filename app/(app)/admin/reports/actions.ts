"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session/require";
import { createClient } from "@/lib/supabase/server";
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

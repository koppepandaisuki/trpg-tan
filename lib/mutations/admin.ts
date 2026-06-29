import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ProductStatus } from "@/lib/format/status";

/**
 * Admin mutations.
 *
 * Thin wrappers over PostgreSQL RPC functions defined in
 * supabase/migrations/0003_admin_rpc.sql. Each RPC performs the state
 * change AND the admin_audit_logs INSERT in one transaction, so either
 * both succeed or both roll back. There is no separate "log writer" here
 * by design — that would re-introduce the partial-failure window we are
 * trying to avoid.
 *
 * We use the regular auth client (not service_role). The RPCs are
 * SECURITY DEFINER and re-check is_admin internally via auth.uid().
 */

export async function grantCreator(targetUserId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("admin_grant_creator", {
    target_id: targetUserId,
  });
  if (error) throw classifyRpcError("grant_creator", error);
}

export async function revokeCreator(targetUserId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("admin_revoke_creator", {
    target_id: targetUserId,
  });
  if (error) throw classifyRpcError("revoke_creator", error);
}

export async function grantAdmin(targetUserId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("admin_grant_admin", {
    target_id: targetUserId,
  });
  if (error) throw classifyRpcError("grant_admin", error);
}

export async function revokeAdmin(targetUserId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("admin_revoke_admin", {
    target_id: targetUserId,
  });
  if (error) throw classifyRpcError("revoke_admin", error);
}

export async function setProductStatus(
  productId: string,
  newStatus: ProductStatus,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("admin_set_product_status", {
    product_id: productId,
    new_status: newStatus,
  });
  if (error) throw classifyRpcError("set_product_status", error);
}

/**
 * 審査キューの判定。approve=true で公開(published)、false で却下(draft に
 * 戻し、note を作者向けの理由として記録)。admin_review_product RPC を呼ぶ。
 */
export async function reviewProduct(
  productId: string,
  approve: boolean,
  note?: string,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("admin_review_product", {
    product_id: productId,
    approve,
    note: note ?? null,
  });
  if (error) throw classifyRpcError("review_product", error);
}

// ---------------------------------------------------------------------
// Error translation
// ---------------------------------------------------------------------

export class AdminRpcError extends Error {
  constructor(
    public action: string,
    public reason:
      | "unauthenticated"
      | "forbidden"
      | "self"
      | "not_found"
      | "invalid"
      | "unknown",
    message: string,
  ) {
    super(message);
    this.name = "AdminRpcError";
  }
}

export function classifyRpcError(
  action: string,
  error: { message?: string },
): AdminRpcError {
  const m = (error.message ?? "").toLowerCase();
  if (m.includes("unauthenticated")) {
    return new AdminRpcError(action, "unauthenticated", "認証が必要です");
  }
  if (m.includes("forbidden")) {
    return new AdminRpcError(action, "forbidden", "管理者権限が必要です");
  }
  if (m.includes("cannot modify self")) {
    return new AdminRpcError(action, "self", "自分自身は変更できません");
  }
  if (m.includes("not found")) {
    return new AdminRpcError(action, "not_found", "対象が見つかりません");
  }
  if (m.includes("invalid status")) {
    return new AdminRpcError(action, "invalid", "無効なステータスです");
  }
  return new AdminRpcError(action, "unknown", "操作に失敗しました");
}

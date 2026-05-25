"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session/require";
import {
  grantCreator,
  revokeCreator,
  AdminRpcError,
} from "@/lib/mutations/admin";

export type AdminActionResult = { ok: true } | { ok: false; message: string };

export async function grantCreatorAction(
  targetUserId: string,
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if (admin.id === targetUserId) {
    return { ok: false, message: "自分自身は変更できません" };
  }
  try {
    await grantCreator(targetUserId);
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: messageOf(e) };
  }
}

export async function revokeCreatorAction(
  targetUserId: string,
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if (admin.id === targetUserId) {
    return { ok: false, message: "自分自身は変更できません" };
  }
  try {
    await revokeCreator(targetUserId);
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: messageOf(e) };
  }
}

function messageOf(e: unknown): string {
  if (e instanceof AdminRpcError) return e.message;
  console.error("[admin/users action] unexpected", e);
  return "操作に失敗しました";
}

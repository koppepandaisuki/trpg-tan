"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session/require";
import {
  grantCreator,
  revokeCreator,
  grantAdmin,
  revokeAdmin,
  adjustGold,
  AdminRpcError,
} from "@/lib/mutations/admin";

export type AdminActionResult = { ok: true } | { ok: false; message: string };

export type AdjustGoldActionResult =
  | { ok: true; balance: number }
  | { ok: false; message: string };

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

export async function grantAdminAction(
  targetUserId: string,
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if (admin.id === targetUserId) {
    return { ok: false, message: "自分自身は変更できません" };
  }
  try {
    await grantAdmin(targetUserId);
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: messageOf(e) };
  }
}

export async function revokeAdminAction(
  targetUserId: string,
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if (admin.id === targetUserId) {
    return { ok: false, message: "自分自身は変更できません" };
  }
  try {
    await revokeAdmin(targetUserId);
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: messageOf(e) };
  }
}

export async function adjustGoldAction(
  targetUserId: string,
  amount: number,
  note?: string,
): Promise<AdjustGoldActionResult> {
  const admin = await requireAdmin();
  if (admin.id === targetUserId) {
    return { ok: false, message: "自分自身は変更できません" };
  }
  if (!Number.isFinite(amount) || Math.trunc(amount) === 0) {
    return { ok: false, message: "金額を入力してください(0以外の整数)" };
  }
  try {
    const balance = await adjustGold(
      targetUserId,
      Math.trunc(amount),
      note?.trim() || undefined,
    );
    revalidatePath("/admin/users");
    return { ok: true, balance };
  } catch (e) {
    return { ok: false, message: messageOf(e) };
  }
}

function messageOf(e: unknown): string {
  if (e instanceof AdminRpcError) return e.message;
  console.error("[admin/users action] unexpected", e);
  return "操作に失敗しました";
}

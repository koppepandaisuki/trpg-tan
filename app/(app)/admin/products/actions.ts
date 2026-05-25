"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session/require";
import { setProductStatus, AdminRpcError } from "@/lib/mutations/admin";
import type { ProductStatus } from "@/lib/format/status";

export type AdminActionResult = { ok: true } | { ok: false; message: string };

const ALLOWED: ProductStatus[] = ["draft", "published", "suspended"];

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

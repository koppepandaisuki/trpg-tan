"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";
import { requireCreator } from "@/lib/session/require";
import { draftSchema, publishSchema } from "@/lib/validators/product";
import {
  createMyProduct,
  updateMyProduct,
} from "@/lib/mutations/creator-products";
import { getMyConnectStatus } from "@/lib/queries/creator-connect";

/**
 * Two Server Actions:
 *
 *   saveDraftAction — lenient validation, persist as draft.
 *   publishAction   — strict validation, persist as published.
 *
 * Both accept productId = null for create or a uuid for update.
 *
 * Behavior after a successful write:
 *   - Update path: return { ok, productId }. Caller stays on the same page
 *     and renders 「保存しました」.
 *   - Create path: redirect() to the edit page with ?saved=1 so the user
 *     lands on a stable URL.
 *
 * Both actions re-derive the user via requireCreator(); the client cannot
 * spoof creator_id.
 */

export type SaveOk = { ok: true; productId: string };
export type SaveErr = {
  error: string;
  fieldErrors?: Record<string, string>;
};
export type SaveResult = SaveOk | SaveErr;

export async function saveDraftAction(
  productId: string | null,
  input: unknown,
): Promise<SaveResult> {
  const user = await requireCreator();
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) return formatZodError(parsed.error);

  if (productId) {
    try {
      await updateMyProduct(user.id, productId, parsed.data, "draft");
    } catch (e) {
      return handleMutationError(e);
    }
    revalidatePath(`/creator/products/${productId}/edit`);
    revalidatePath("/creator/products");
    return { ok: true, productId };
  }

  const created = await safeCreate(user.id, parsed.data, "draft");
  if ("error" in created) return created;
  revalidatePath("/creator/products");
  redirect(`/creator/products/${created.productId}/edit?saved=1`);
}

export async function publishAction(
  productId: string | null,
  input: unknown,
): Promise<SaveResult> {
  const user = await requireCreator();
  const parsed = publishSchema.safeParse(input);
  if (!parsed.success) return formatZodError(parsed.error);

  // D-020 PR3: publish には Stripe Connect onboarding 完了が必須。
  // Connect 未完了なら destination charge が組めない = 公開できても購入
  // できないため、公開時点で弾く(draft は引き続き可)。
  // チェックは Server Action 側で行う(publishSchema は DB アクセス不可で
  // ここまで持ってこれないため)。
  const connect = await getMyConnectStatus(user.id);
  if (!connect.stripeChargesEnabled) {
    return {
      error:
        "公開には Stripe 接続(受取口座設定)の完了が必要です。クリエイターメニュー → Stripe 接続 から手続きしてください",
    };
  }

  if (productId) {
    try {
      await updateMyProduct(user.id, productId, parsed.data, "published");
    } catch (e) {
      return handleMutationError(e);
    }
    revalidatePath(`/creator/products/${productId}/edit`);
    revalidatePath("/creator/products");
    revalidatePath("/store");
    return { ok: true, productId };
  }

  const created = await safeCreate(user.id, parsed.data, "published");
  if ("error" in created) return created;
  revalidatePath("/creator/products");
  revalidatePath("/store");
  redirect(`/creator/products/${created.productId}/edit?saved=1&published=1`);
}

// ---------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------

async function safeCreate(
  userId: string,
  // Use the most permissive shape — publish input is a strict superset of draft.
  input: Parameters<typeof createMyProduct>[1],
  intent: "draft" | "published",
): Promise<SaveOk | SaveErr> {
  try {
    const { id } = await createMyProduct(userId, input, intent);
    return { ok: true, productId: id };
  } catch (e) {
    return handleMutationError(e);
  }
}

function handleMutationError(e: unknown): SaveErr {
  if (e instanceof Error && e.message === "NOT_FOUND") {
    return { error: "対象の作品が見つかりませんでした" };
  }
  console.error("[creator-products action] mutation failed", e);
  return { error: "保存に失敗しました。時間をおいて再度お試しください" };
}

function formatZodError(error: ZodError): SaveErr {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.errors) {
    const path = issue.path.join(".");
    if (path && !fieldErrors[path]) {
      fieldErrors[path] = issue.message;
    }
  }
  const first = error.errors[0]?.message ?? "入力内容を確認してください";
  return { error: first, fieldErrors };
}

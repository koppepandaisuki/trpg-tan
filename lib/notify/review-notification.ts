import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";
import {
  reviewApprovedEmail,
  reviewRejectedEmail,
  reviewSuspendedEmail,
} from "@/lib/email/templates";

/**
 * 出品審査(承認 / 却下 / 公開停止)の結果をクリエイターにメール通知する。
 *
 * - product から creator_id / title / slug を引き、creator のメールは admin
 *   client(service role)の auth.admin.getUserById で取得する(profiles には
 *   メールを持たせていないため)。
 * - メール未設定(RESEND_API_KEY/EMAIL_FROM 無し)なら送信側で skipped。
 * - **例外は投げない**。通知は付随処理で、審査操作を止めてはいけない。
 */

interface Recipient {
  email: string;
  title: string;
  slug: string;
}

function siteBase(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

/** product から宛先(creator のメール)+ タイトル / slug を解決する。失敗時 null。 */
async function resolveRecipient(
  admin: SupabaseClient,
  productId: string,
): Promise<Recipient | null> {
  const { data: product, error: prodErr } = await admin
    .from("products")
    .select("creator_id, title, slug")
    .eq("id", productId)
    .maybeSingle();
  if (prodErr || !product) {
    console.error("[notify] product fetch failed", prodErr?.message);
    return null;
  }
  const { data: userRes, error: userErr } =
    await admin.auth.admin.getUserById(product.creator_id);
  const email = userRes?.user?.email;
  if (userErr || !email) {
    console.error("[notify] creator email unavailable", userErr?.message);
    return null;
  }
  return { email, title: product.title, slug: product.slug };
}

/**
 * アプリ内通知(notifications)へ審査結果を書き込む。メールの設定有無に
 * 関わらず常に記録する(デスクトップ/Web のインボックスに出る)。
 * notifications への INSERT はポリシーが無い(定義済み RPC 経由のみ)ため
 * service_role の admin client から直接書き込む。失敗しても審査処理は継続。
 */
async function insertReviewNotification(
  admin: SupabaseClient,
  input: {
    productId: string;
    creatorId: string;
    title: string;
    decision: "approved" | "rejected" | "suspended";
    reason?: string;
  },
): Promise<void> {
  try {
    const { error } = await admin.from("notifications").insert({
      user_id: input.creatorId,
      kind: "review_decision",
      payload: {
        productId: input.productId,
        productTitle: input.title,
        decision: input.decision,
        reason: input.reason ?? "",
      },
    });
    if (error) console.error("[notify] insert failed", error.message);
  } catch (e) {
    console.error("[notify] insert unexpected", e);
  }
}

/** 承認 / 却下の通知(アプリ内通知 + メール)。 */
export async function notifyReviewDecision(input: {
  productId: string;
  approve: boolean;
  note?: string;
}): Promise<void> {
  const admin = createAdminClient();
  const { data: product } = await admin
    .from("products")
    .select("creator_id, title")
    .eq("id", input.productId)
    .maybeSingle();
  if (product) {
    await insertReviewNotification(admin, {
      productId: input.productId,
      creatorId: product.creator_id,
      title: product.title,
      decision: input.approve ? "approved" : "rejected",
      reason: input.note,
    });
  }

  if (!isEmailConfigured()) return;
  try {
    const r = await resolveRecipient(admin, input.productId);
    if (!r) return;

    const base = siteBase();
    const content = input.approve
      ? reviewApprovedEmail({
          productTitle: r.title,
          productUrl: `${base}/store/${r.slug}`,
        })
      : reviewRejectedEmail({
          productTitle: r.title,
          reason: input.note ?? "",
          editUrl: `${base}/creator/products/${input.productId}/edit`,
        });

    const result = await sendEmail({ to: r.email, ...content });
    if (!result.ok) console.error("[notifyReviewDecision] send failed", result.error);
  } catch (e) {
    console.error("[notifyReviewDecision] unexpected", e);
  }
}

/** 公開停止(takedown)の通知(アプリ内通知 + メール)。理由は任意(通報起因なら通報理由)。 */
export async function notifySuspension(input: {
  productId: string;
  reason?: string;
}): Promise<void> {
  const admin = createAdminClient();
  const { data: product } = await admin
    .from("products")
    .select("creator_id, title")
    .eq("id", input.productId)
    .maybeSingle();
  if (product) {
    await insertReviewNotification(admin, {
      productId: input.productId,
      creatorId: product.creator_id,
      title: product.title,
      decision: "suspended",
      reason: input.reason,
    });
  }

  if (!isEmailConfigured()) return;
  try {
    const r = await resolveRecipient(admin, input.productId);
    if (!r) return;

    const content = reviewSuspendedEmail({
      productTitle: r.title,
      reason: input.reason,
      editUrl: `${siteBase()}/creator/products/${input.productId}/edit`,
    });
    const result = await sendEmail({ to: r.email, ...content });
    if (!result.ok) console.error("[notifySuspension] send failed", result.error);
  } catch (e) {
    console.error("[notifySuspension] unexpected", e);
  }
}

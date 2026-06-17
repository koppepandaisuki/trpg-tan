import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";
import {
  reviewApprovedEmail,
  reviewRejectedEmail,
} from "@/lib/email/templates";

/**
 * 審査の承認/却下をクリエイターにメール通知する。
 *
 * - product から creator_id / title / slug を引き、creator のメールは
 *   admin client(service role)の auth.admin.getUserById で取得する
 *   (profiles にはメールを持たせていないため)。
 * - メール未設定(RESEND_API_KEY/EMAIL_FROM 無し)なら送信側で skipped。
 * - **例外は投げない**。通知は付随処理で、審査操作を止めてはいけない。
 */
export async function notifyReviewDecision(input: {
  productId: string;
  approve: boolean;
  note?: string;
}): Promise<void> {
  // 未設定なら admin / auth 問い合わせもせず早期 return(無駄打ち回避)。
  if (!isEmailConfigured()) return;

  try {
    const admin = createAdminClient();

    const { data: product, error: prodErr } = await admin
      .from("products")
      .select("creator_id, title, slug")
      .eq("id", input.productId)
      .maybeSingle();
    if (prodErr || !product) {
      console.error("[notifyReviewDecision] product fetch failed", prodErr?.message);
      return;
    }

    const { data: userRes, error: userErr } =
      await admin.auth.admin.getUserById(product.creator_id);
    const email = userRes?.user?.email;
    if (userErr || !email) {
      console.error("[notifyReviewDecision] creator email unavailable", userErr?.message);
      return;
    }

    const base = (
      process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
    ).replace(/\/$/, "");

    const content = input.approve
      ? reviewApprovedEmail({
          productTitle: product.title,
          productUrl: `${base}/store/${product.slug}`,
        })
      : reviewRejectedEmail({
          productTitle: product.title,
          reason: input.note ?? "",
          editUrl: `${base}/creator/products/${input.productId}/edit`,
        });

    const result = await sendEmail({ to: email, ...content });
    if (!result.ok) {
      console.error("[notifyReviewDecision] send failed", result.error);
    }
  } catch (e) {
    console.error("[notifyReviewDecision] unexpected", e);
  }
}

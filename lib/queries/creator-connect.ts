import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Creator-scoped query for Stripe Connect state.
 *
 * D-020 / PR2: onboarding ページが「未開始 / 進行中 / 完了」の 3 状態を
 * 描画するために最小限の列だけを返す。RLS で自分の行のみアクセス可。
 *
 * 読み出しエラーは "no connect" にフォールバックする(認証クライアント越しに
 * 読めない = まだ何もしていない、と同義に扱って UI 上で再接続を促せる)。
 */

export type ConnectStatus = {
  stripeAccountId: string | null;
  stripeChargesEnabled: boolean;
};

export async function getMyConnectStatus(
  userId: string,
): Promise<ConnectStatus> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("stripe_account_id, stripe_charges_enabled")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[getMyConnectStatus] read failed", error);
    return { stripeAccountId: null, stripeChargesEnabled: false };
  }

  return {
    stripeAccountId: data?.stripe_account_id ?? null,
    stripeChargesEnabled: data?.stripe_charges_enabled ?? false,
  };
}

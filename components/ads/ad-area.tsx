import { getCurrentUser } from "@/lib/session/get-user";
import { adsenseClient, shouldShowAds } from "@/lib/ads";
import { AdSlot } from "./ad-slot";

/**
 * 広告を置く場所(Server Component)。無料プラン・未ログインの人にだけ、
 * env の広告ユニット(NEXT_PUBLIC_ADSENSE_SLOT)を 1 つ出す。卓のプレイ画面には置かない。
 */
export async function AdArea() {
  const client = adsenseClient();
  const slot = process.env.NEXT_PUBLIC_ADSENSE_SLOT;
  if (!client || !slot) return null;
  const user = await getCurrentUser();
  if (!shouldShowAds(user)) return null;
  return <AdSlot client={client} slot={slot} />;
}

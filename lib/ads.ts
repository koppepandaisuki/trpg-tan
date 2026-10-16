import { normalizePlan } from "@/lib/plan";

/**
 * 広告(Google AdSense)の設定と表示判定。
 *
 *   - NEXT_PUBLIC_ADSENSE_CLIENT(ca-pub-…)が未設定なら広告は一切出さない
 *     (スクリプトも読み込まない・CSP も広げない。next.config.mjs)。
 *   - 有料プラン(play / pro)と管理者には出さない。
 *   - 卓のプレイ画面(/play/[id]・/play/join)には出さない(没入感を壊さない。
 *     利用規約 第 12 条)。置き場所は AdArea を置いたページだけ。
 *
 * 広告を出し始めるときは、プライバシーポリシーの外部送信の表に AdSense の行が
 * 自動で出る(app/privacy/page.tsx)。Google の同意管理(CMP)の設定も確認すること
 * (docs/legal/README.md)。
 */

export function adsenseClient(): string | null {
  const v = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  return v && /^ca-pub-\d+$/.test(v.trim()) ? v.trim() : null;
}

/** ads.txt に載せるパブリッシャー ID(ca-pub-123 → pub-123)。 */
export function adsensePublisherId(): string | null {
  const c = adsenseClient();
  return c ? c.replace(/^ca-/, "") : null;
}

export function shouldShowAds(
  user: { plan?: string | null; isAdmin?: boolean } | null,
): boolean {
  if (!adsenseClient()) return false;
  if (!user) return true;
  if (user.isAdmin) return false;
  return normalizePlan(user.plan) === "basic";
}

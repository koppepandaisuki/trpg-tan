import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import { FeedbackLauncher } from "@/components/feedback/feedback-launcher";
import { TestModeBanner } from "@/components/banner/test-mode-banner";
import { SiteFooter } from "@/components/layout/site-footer";
import "./globals.css";

const notoSansJp = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TRPG プラットフォーム",
  description: "TRPG向け作品の販売・購入・管理を行うプラットフォーム",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={notoSansJp.variable}>
      {/* flex-col + min-h-screen で sticky footer パターン:
          コンテンツが短いページでもフッターを画面下に貼り付け、
          長いページではコンテンツの下に自然に流れる。 */}
      <body className="flex min-h-screen flex-col bg-background">
        {/* α 期間 + Stripe Test mode のとき、画面最上部に告知バナーを表示。
            Live mode 切替時に自動で消える(STRIPE_SECRET_KEY のプレフィクス判定)。 */}
        <TestModeBanner />

        {/* flex-1 で残り高を占有、フッターを下に押し下げる */}
        <div className="flex-1">{children}</div>

        <SiteFooter />

        {/* α 期間中のフィードバック収集インフラ。Server Component が
            認証状態を確認、ログイン済の時だけ floating button を出す。 */}
        <FeedbackLauncher />
      </body>
    </html>
  );
}

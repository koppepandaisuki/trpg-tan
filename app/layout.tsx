import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import { FeedbackLauncher } from "@/components/feedback/feedback-launcher";
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
      <body className="min-h-screen bg-background">
        {children}
        {/* α 期間中のフィードバック収集インフラ。Server Component が
            認証状態を確認、ログイン済の時だけ floating button を出す。 */}
        <FeedbackLauncher />
      </body>
    </html>
  );
}

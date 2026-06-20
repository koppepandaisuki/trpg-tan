import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP } from "next/font/google";
import { FeedbackLauncher } from "@/components/feedback/feedback-launcher";
import { TestModeBanner } from "@/components/banner/test-mode-banner";
import { SiteFooter } from "@/components/layout/site-footer";
import { WelcomeTour } from "@/components/onboarding/welcome-tour";
import "./globals.css";

const notoSansJp = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

// ブランド名は「パラDa-iCE」(短) / 「パラDa-iCE TRPGサイト」(フル)。
// title.template により、子ページが string で title を返せば自動で
// `${ページ名} | パラDa-iCE` の suffix が付く(子側で長いサフィックスを
// 書く必要が無くなり、ブランド名変更時の差分も layout に集約される)。
//
// 子ページで suffix を付けたくない場合は `title: { absolute: "..." }` で
// バイパス可能(Next.js metadata の標準仕様)。
//
// SEO + OG / Twitter Card 関連:
//  - metadataBase は OG image など相対パスの絶対 URL 解決に必須
//    (NEXT_PUBLIC_SITE_URL が未設定なら本番ドメイン fallback)
//  - openGraph + twitter で SNS シェアカードのタイトル / 説明 / 画像を
//    明示。画像自体は app/opengraph-image.png / app/twitter-image.png
//    を Next.js が自動で参照する(再指定不要)
//  - description は 130 字以内を意識(検索結果のスニペット切れ防止)
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://trpg-tan.vercel.app";

const DESCRIPTION =
  "シナリオ・ルールブック・マップ・BGM など、TRPG向け作品を販売・購入できるマーケットプレイス。クリエイターは α 期間中、自動で出品権限が付与されます。";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "パラDa-iCE TRPGサイト",
    template: "%s | パラDa-iCE",
  },
  description: DESCRIPTION,
  applicationName: "パラDa-iCE",
  keywords: [
    "TRPG",
    "テーブルトークRPG",
    "シナリオ",
    "ルールブック",
    "マップ",
    "BGM",
    "マーケットプレイス",
    "パラDa-iCE",
    "クトゥルフ",
    "創作",
  ],
  authors: [{ name: "パラDa-iCE" }],
  creator: "パラDa-iCE",
  publisher: "パラDa-iCE",
  // 検索エンジンには通常表示(α 期間中は noindex でもよいが、現状は流入
  // 歓迎の方針なので index: true)。本番の Robots.txt と整合させる。
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: SITE_URL,
    siteName: "パラDa-iCE TRPGサイト",
    title: "パラDa-iCE TRPGサイト",
    description: DESCRIPTION,
    // 画像は app/opengraph-image.png を Next.js が自動付加するため、
    // ここでは明示しない(二重指定で URL 衝突を避ける)
  },
  twitter: {
    card: "summary_large_image",
    title: "パラDa-iCE TRPGサイト",
    description: DESCRIPTION,
    // 画像は app/twitter-image.png 経由(同上)
  },
  // テスター環境であることを示すカテゴリヒント(検索エンジン向け)
  category: "Marketplace",
};

// このサイトはライト専用デザイン。`<meta name="color-scheme" content="only light">`
// を出力し、OS / ブラウザの自動ダーク化による配色反転(可読性崩れ)を防ぐ。
// globals.css の :root { color-scheme: only light } と二重で宣言。
export const viewport: Viewport = {
  colorScheme: "only light",
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

        {/* 初回訪問時に表示されるオンボーディング tour。
            localStorage で初回判定、別所(フッター)から再表示も可能。 */}
        <WelcomeTour />
      </body>
    </html>
  );
}

import Link from "next/link";
import { HelpCircle, MessageCircle, ShoppingBag, Upload, User } from "lucide-react";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { FaqGroup, type FaqEntry } from "@/components/help/faq-accordion";

export const metadata = {
  title: "ヘルプ・よくある質問",
  description:
    "Re-dice TRPGサイトの使い方、購入・販売・アカウントに関するよくある質問。",
};

const DISCORD_URL = "https://discord.gg/HMXx3pbAEz";

const BUYER_FAQ: FaqEntry[] = [
  {
    question: "作品を購入するにはどうすればいいですか?",
    answer: [
      "作品ページの「購入する」ボタンから、クレジットカード決済(Stripe)で購入できます。決済完了後すぐにライブラリからダウンロードできます。",
    ],
  },
  {
    question: "購入した作品はどこから見られますか?",
    answer: [
      "ヘッダーの「ライブラリ」から、購入済みの全作品を確認・ダウンロードできます。",
    ],
  },
  {
    question: "購入した作品を返金してもらえますか?",
    answer: [
      "デジタル作品の性質上、原則として返品・返金はお受けできません。",
      "ただし、作品が説明と著しく異なる場合や、ダウンロードできない不具合がある場合は、Discord にてご相談ください。",
    ],
  },
  {
    question: "レビューはどうやって投稿しますか?",
    answer: [
      "作品を購入すると、作品ページのレビュー欄に「高評価 / 低評価」とコメントを投稿できるようになります。",
    ],
  },
  {
    question: "α テスト期間中の決済は本物ですか?",
    answer: [
      "α 期間中は Stripe の Test mode で動作しています。実際の請求は発生しません。テスト用カード番号(4242 4242 4242 4242)をご利用ください。",
      "実物の本人確認書類や個人情報は登録しないでください。",
    ],
  },
];

const CREATOR_FAQ: FaqEntry[] = [
  {
    question: "作品を販売するにはどうすればいいですか?",
    answer: [
      "ヘッダーの「投稿する」から作品を登録し、「公開して保存」でストアに掲載されます。α 期間中は登録すると自動でクリエイター権限が付与されます。",
    ],
  },
  {
    question: "有料で販売するには何が必要ですか?",
    answer: [
      "有料販売には Stripe 接続(受取口座の設定)が必要です。クリエイターメニューの「Stripe 接続」から手続きしてください。",
      "価格 ¥0(無料)の作品は、Stripe 接続が未完了でも公開できます。",
    ],
  },
  {
    question: "売上はどのように受け取れますか?",
    answer: [
      "販売代金からプラットフォーム手数料(30%)を差し引いた 70% が、Stripe を通じてあなたの銀行口座に入金されます。",
    ],
  },
  {
    question: "スクリーンショットは登録できますか?",
    answer: [
      "作品編集ページの「スクリーンショット」から、最大 4 枚まで登録できます。商品詳細ページのギャラリーに表示されます。",
    ],
  },
  {
    question: "活動を休止したいときは?",
    answer: [
      "作品管理ページの「すべて非公開にする」で、公開中の全作品を一括で下書きに戻せます。作品データは残るので、再開時に再公開できます。",
    ],
  },
];

const ACCOUNT_FAQ: FaqEntry[] = [
  {
    question: "パスワードを忘れました。",
    answer: [
      "ログインページの「パスワードをお忘れですか?」から、登録メールアドレス宛に再設定リンクを送信できます。",
    ],
  },
  {
    question: "メールアドレスやパスワードを変更したい。",
    answer: [
      "アカウント設定ページ(ヘッダーの自分の名前をクリック)から、メールアドレス・パスワードを変更できます。",
    ],
  },
  {
    question: "退会(アカウント削除)したい。",
    answer: [
      "アカウント設定ページの最下部「退会する」から手続きできます。",
      "作品を公開・登録中のクリエイターは、先に全作品を削除するか Discord にてご相談ください。",
    ],
  },
  {
    question: "お気に入りや閲覧履歴はどこに保存されますか?",
    answer: [
      "お気に入りと閲覧履歴は、お使いの端末のブラウザ内にのみ保存されます。サーバーには送信されず、別の端末やシークレットウィンドウには引き継がれません。",
    ],
  },
];

export default function HelpPage() {
  return (
    <>
      <TopHeader />
      <PageContainer className="space-y-6 py-8">
        <Breadcrumb items={[{ label: "ヘルプ", icon: HelpCircle }]} />

        {/* Hero */}
        <Card className="overflow-hidden border-border bg-gradient-to-br from-sky-500/8 via-transparent to-violet-500/8 shadow-sm">
          <CardContent className="relative py-6 sm:py-8">
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-violet-500/10 blur-3xl" />
            <div className="relative z-10 flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-sky-300 bg-sky-50 text-sky-700">
                <HelpCircle className="h-5 w-5" aria-hidden />
              </div>
              <div className="flex-1 space-y-1.5">
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  ヘルプ・よくある質問
                </h1>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  購入・販売・アカウントに関するよくある質問をまとめています。
                  解決しない場合は Discord でお気軽にお問い合わせください。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FAQ グループ */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <ShoppingBag className="h-3.5 w-3.5" aria-hidden />
            購入について
          </div>
          <FaqGroup title="" items={BUYER_FAQ} />

          <div className="flex items-center gap-2 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Upload className="h-3.5 w-3.5" aria-hidden />
            販売・クリエイターについて
          </div>
          <FaqGroup title="" items={CREATOR_FAQ} />

          <div className="flex items-center gap-2 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <User className="h-3.5 w-3.5" aria-hidden />
            アカウントについて
          </div>
          <FaqGroup title="" items={ACCOUNT_FAQ} />
        </div>

        {/* お問い合わせ CTA */}
        <Card className="overflow-hidden border-sky-200 bg-sky-50/40 shadow-sm">
          <CardContent className="flex flex-col items-start gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold tracking-tight">
                解決しませんでしたか?
              </p>
              <p className="text-xs text-muted-foreground">
                α 期間中のお問い合わせ・不具合報告は Discord で受け付けています。
              </p>
            </div>
            <a
              href={DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-2 rounded-md border border-sky-300 bg-sky-100 px-4 py-2 text-sm font-medium text-sky-800 transition hover:bg-sky-200"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              Discord で質問する
            </a>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          利用条件の詳細は{" "}
          <Link
            href="/terms"
            className="text-accent underline-offset-4 hover:underline"
          >
            利用規約
          </Link>{" "}
          をご確認ください。
        </p>
      </PageContainer>
    </>
  );
}

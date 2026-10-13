import Link from "next/link";
import {
  CreditCard,
  Dices,
  FolderOpen,
  HelpCircle,
  MessageCircle,
  User,
} from "lucide-react";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { FaqGroup, type FaqEntry } from "@/components/help/faq-accordion";

export const metadata = {
  title: "ヘルプ・よくある質問",
  description:
    "Re-dice の使い方、PLAY・ライブラリ・プラン・アカウントに関するよくある質問。",
};

const DISCORD_URL = "https://discord.gg/HMXx3pbAEz";

const PLAY_FAQ: FaqEntry[] = [
  {
    question: "卓を立てるにはどうすればいいですか?",
    answer: [
      "ヘッダーの「PLAY」で卓のタイトルを入れて「作る」を押すと、盤面が開きます。駒・背景・BGM などを用意して、そのまま一人で準備・保存できます。",
      "仲間と遊ぶときは、卓の右上の「みんなで遊ぶ」で参加コードを発行し、招待リンクか参加コードを共有します(無料)。",
      "「TRPGシナリオ工房」で書いたシナリオは、工房の「バックアップ」で書き出した .zip を PLAY の「シナリオ工房から卓を作る」で読み込むと、シーン・読み上げ文・NPC・ハンドアウト入りの卓になります。",
    ],
  },
  {
    question: "参加するにはどうすればいいですか?",
    answer: [
      "GM から届いた招待リンクを開くか、「PLAY」の「卓に参加する」に参加コードを入力してください。ログインもアプリのインストールも不要で、表示名だけで参加できます(ログインすると、キャラシで保存したキャラを駒として出せます)。",
    ],
  },
  {
    question: "デスクトップアプリの卓とブラウザの卓は一緒に遊べますか?",
    answer: [
      "はい。同じ仕組みで同期しているので、アプリで立てた卓にブラウザから参加すること(その逆も)ができます。",
    ],
  },
  {
    question: "BGM や効果音が鳴りません。",
    answer: [
      "ブラウザは画面を操作するまで音を止める仕様です。入室後に画面のどこかを一度クリックすると鳴り始めます。",
    ],
  },
];

const LIBRARY_FAQ: FaqEntry[] = [
  {
    question: "ライブラリには何が保存されますか?",
    answer: [
      "立てた卓(自動で保存されます)と、背景・駒・BGM などの素材です。卓でアップロードした画像・音声も自動でライブラリの「素材」に並びます。",
    ],
  },
  {
    question: "素材をライブラリから外すと、卓の画像や音も消えますか?",
    answer: [
      "消えません。ライブラリから外すのは一覧からだけで、すでに卓で使っている画像・音はそのまま残ります。",
    ],
  },
];

const BILLING_FAQ: FaqEntry[] = [
  {
    question: "無料でどこまで使えますか?",
    answer: [
      "卓の作成・保存・ホスト(仲間を招いて遊ぶ)・参加、ライブラリ、キャラクター作成(保存は 10 体まで)、日程調整は無料です。キャラの保存数を無制限にするには Pro プランが必要です。詳しくは料金プランをご覧ください。",
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
        <Card className="overflow-hidden border-border bg-gradient-to-br from-red-500/8 via-transparent to-amber-500/8 shadow-sm">
          <CardContent className="relative py-6 sm:py-8">
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-500/10 blur-3xl" />
            <div className="relative z-10 flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-red-300 bg-red-50 text-red-700">
                <HelpCircle className="h-5 w-5" aria-hidden />
              </div>
              <div className="flex-1 space-y-1.5">
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  ヘルプ・よくある質問
                </h1>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  PLAY・ライブラリ・プラン・アカウントに関するよくある質問をまとめています。
                  解決しない場合は Discord でお気軽にお問い合わせください。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FAQ グループ */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Dices className="h-3.5 w-3.5" aria-hidden />
            PLAY について
          </div>
          <FaqGroup title="" items={PLAY_FAQ} />

          <div className="flex items-center gap-2 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <FolderOpen className="h-3.5 w-3.5" aria-hidden />
            ライブラリについて
          </div>
          <FaqGroup title="" items={LIBRARY_FAQ} />

          <div className="flex items-center gap-2 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <CreditCard className="h-3.5 w-3.5" aria-hidden />
            プラン・お支払いについて
          </div>
          <FaqGroup title="" items={BILLING_FAQ} />

          <div className="flex items-center gap-2 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <User className="h-3.5 w-3.5" aria-hidden />
            アカウントについて
          </div>
          <FaqGroup title="" items={ACCOUNT_FAQ} />
        </div>

        {/* お問い合わせ CTA */}
        <Card className="overflow-hidden border-red-200 bg-red-50/40 shadow-sm">
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
              className="inline-flex shrink-0 items-center gap-2 rounded-md border border-red-300 bg-red-100 px-4 py-2 text-sm font-medium text-red-800 transition hover:bg-red-200"
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

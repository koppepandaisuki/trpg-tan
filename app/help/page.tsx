import Link from "next/link";
import {
  CalendarDays,
  CreditCard,
  Dices,
  FolderOpen,
  HelpCircle,
  Mail,
  MessageCircle,
  ScrollText,
  ShieldCheck,
  User,
} from "lucide-react";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { FaqGroup, type FaqEntry } from "@/components/help/faq-accordion";
import { buttonVariants } from "@/components/ui/button";
import { getOperator } from "@/lib/legal/operator";
import { isStripeTestMode } from "@/lib/stripe/mode";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "ヘルプ・よくある質問",
  description:
    "Re-dice の使い方。PLAY・キャラシ・日程調整・安全・プラン・アカウントに関するよくある質問。",
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

const SHEET_FAQ: FaqEntry[] = [
  {
    question: "どのシステムのキャラシを作れますか?",
    answer: [
      "クトゥルフ神話TRPG(第7版・第6版)は専用のエディタで作れます。ソード・ワールド2.5、ダブルクロス The 3rd Edition、シノビガミなどのシステムも、それぞれの項目で作れます。一覧は「キャラシ」のページをご覧ください。",
    ],
  },
  {
    question: "ログインしないと作れませんか?",
    answer: [
      "作成・編集はログインなしでできます。保存するにはログインが必要です(無料プランは 10 体まで、Pro プランは無制限)。",
    ],
  },
  {
    question: "ココフォリアの駒を取り込めますか?",
    answer: [
      "はい。ココフォリアで「コマをコピー」した内容を、キャラシのページの「他サイトから取り込み」か、卓の「コマ貼付」に貼り付けると取り込めます。",
    ],
  },
  {
    question: "作ったキャラを卓に出すには?",
    answer: [
      "卓の「自分のキャラを出す」から、キャラシで保存したキャラを駒として出せます(ログインが必要です)。卓では、発言者が自動で自分のキャラになり、技能の判定はボタン 1 回で振れます。",
    ],
  },
];

const SCHEDULE_FAQ: FaqEntry[] = [
  {
    question: "日程調整の使い方は?",
    answer: [
      "「日程調整」で候補の日時を並べて作ると、回答用の URL ができます。参加者はログインなしで ○△× を入れられます。",
    ],
  },
  {
    question: "フレンドになると何ができますか?",
    answer: [
      "フレンドのページの招待リンクを送り、相手が開くとフレンドになれます。日程調整にフレンドをまとめて招待できます。フレンドの人数に制限はありません。",
    ],
  },
];

const SAFETY_FAQ: FaqEntry[] = [
  {
    question: "シークレットダイスや秘密のチャットは、他の人に見えませんか?",
    answer: [
      "見えません。結果や内容は GM と本人にだけ届きます。本人宛てに暗号化して送るので、通信の途中でも他の参加者には読めません。",
    ],
  },
  {
    question: "直結(P2P)だと、IP アドレスは相手に伝わりますか?",
    answer: [
      "直結している相手(GM と参加者)には、互いの IP アドレスが伝わります。気になる場合は、卓の上部の接続表示を開いて「直結(P2P)を使う」を外すと、中継だけで通信します(少し遅くなることがあります)。",
    ],
  },
  {
    question: "他の人が GM や参加者になりすますことはできませんか?",
    answer: [
      "防いでいます。卓の通信には署名を付けていて、参加コードは GM の鍵から作られます。GM を装った配信や、他の参加者を装った操作は受け付けません(古い版のアプリとつなぐときは互換のため一部が例外になるので、アプリは最新にしてください)。",
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
];

/** 決済の FAQ は、テスト中(Stripe の Test mode)と本番で答えが違う。 */
function billingFaq(testMode: boolean): FaqEntry[] {
  const pay: FaqEntry = testMode
    ? {
        question: "α テスト期間中の決済は本物ですか?",
        answer: [
          "α 期間中は Stripe の Test mode で動作しています。実際の請求は発生しません。テスト用カード番号(4242 4242 4242 4242)をご利用ください。",
          "実物の本人確認書類や個人情報は登録しないでください。",
        ],
      }
    : {
        question: "支払い方法と解約は?",
        answer: [
          "お支払いは Stripe の決済画面で行います。料金プランのページで、利用中のプランの「契約を管理」から、支払い方法の変更や解約ができます。",
        ],
      };
  return [...BILLING_FAQ, pay];
}

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
    answer: ["アカウント設定ページの最下部「退会する」から手続きできます。"],
  },
];

export default function HelpPage() {
  const { email } = getOperator();
  const testMode = isStripeTestMode();
  return (
    <>
      <TopHeader />
      <PageContainer className="space-y-6 py-8">
        <Breadcrumb items={[{ label: "ヘルプ", icon: HelpCircle }]} />

        {/* Hero */}
        <Card className="overflow-hidden border-border shadow-sm">
          <CardContent className="relative py-6 sm:py-8">
            <div className="relative z-10 flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink text-white">
                <HelpCircle className="h-5 w-5" aria-hidden />
              </div>
              <div className="flex-1 space-y-1.5">
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  ヘルプ・よくある質問
                </h1>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  PLAY・キャラシ・日程調整・安全・プラン・アカウントについて、よくある質問をまとめています。
                  解決しない場合は、メールか Discord でお問い合わせください。
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
            <ScrollText className="h-3.5 w-3.5" aria-hidden />
            キャラシについて
          </div>
          <FaqGroup title="" items={SHEET_FAQ} />

          <div className="flex items-center gap-2 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            日程調整・フレンドについて
          </div>
          <FaqGroup title="" items={SCHEDULE_FAQ} />

          <div className="flex items-center gap-2 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            安全・プライバシーについて
          </div>
          <FaqGroup title="" items={SAFETY_FAQ} />

          <div className="flex items-center gap-2 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <CreditCard className="h-3.5 w-3.5" aria-hidden />
            プラン・お支払いについて
          </div>
          <FaqGroup title="" items={billingFaq(testMode)} />

          <div className="flex items-center gap-2 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <User className="h-3.5 w-3.5" aria-hidden />
            アカウントについて
          </div>
          <FaqGroup title="" items={ACCOUNT_FAQ} />
        </div>

        {/* お問い合わせ CTA */}
        <Card className="overflow-hidden border-transparent bg-ink text-white shadow-sm">
          <CardContent className="flex flex-col items-start gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold tracking-tight">解決しませんでしたか?</p>
              <p className="text-xs text-white/65">
                お問い合わせ・不具合報告はメールか Discord で受け付けています。
                ログイン中は、画面右下の「フィードバックを送る」ボタンからも送れます。
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {email && (
                <a href={`mailto:${email}`} className={cn(buttonVariants({ variant: "primary" }))}>
                  <Mail aria-hidden />
                  メールで問い合わせる
                </a>
              )}
              <a
                href={DISCORD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "border-white/25 bg-transparent text-white hover:border-white/50 hover:bg-white/10",
                )}
              >
                <MessageCircle aria-hidden />
                Discord で質問する
              </a>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          利用条件の詳細は{" "}
          <Link href="/terms" className="text-accent underline-offset-4 hover:underline">
            利用規約
          </Link>{" "}
          をご確認ください。
        </p>
      </PageContainer>
    </>
  );
}

import { Check, Gamepad2, Sparkles, Star, Crown } from "lucide-react";
import { TopHeader } from "@/components/layout/top-header";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { getCurrentUser } from "@/lib/session/get-user";
import { PLATFORM_FEE_RATE, PRO_PLATFORM_FEE_RATE } from "@/lib/stripe/fees";
import { PLAN_LABEL, PLAN_PRICE_JPY, type UserPlan } from "@/lib/plan";
import { PlanSelectButton } from "@/components/plan/plan-select-button";
import { isPlanBillingConfigured } from "@/lib/stripe/subscription";

export const metadata = {
  title: "料金プラン",
  description:
    "Re-dice の料金プラン。基本（無料）/ プレイ（PLAY解放）/ Pro（手数料優遇など）の3段階。",
};

const BASIC_PCT = Math.round(PLATFORM_FEE_RATE * 100);
const PRO_PCT = Math.round(PRO_PLATFORM_FEE_RATE * 100);

type Perk = { label: string; soon?: boolean; star?: boolean };

/** プランごとのブランドカラー(スカイ系の寒色ランプ: シアン→スカイ→インディゴ)。 */
const THEME: Record<
  UserPlan,
  { code: string; text: string; border: string; check: string; btn: string }
> = {
  basic: {
    code: "BASIC",
    text: "text-cyan-600",
    border: "border-cyan-300",
    check: "bg-cyan-500",
    btn: "bg-cyan-500 hover:bg-cyan-600",
  },
  play: {
    code: "PLAY",
    text: "text-sky-600",
    border: "border-sky-400",
    check: "bg-sky-500",
    btn: "bg-sky-600 hover:bg-sky-700",
  },
  pro: {
    code: "PRO",
    text: "text-indigo-600",
    border: "border-indigo-300",
    check: "bg-indigo-500",
    btn: "bg-indigo-600 hover:bg-indigo-700",
  },
};

const PLANS: {
  plan: UserPlan;
  icon: typeof Sparkles;
  tagline: string;
  perks: Perk[];
  featured?: boolean;
}[] = [
  {
    plan: "basic",
    icon: Sparkles,
    tagline: "まずは無料で",
    perks: [
      { label: "ストア閲覧・購入・ライブラリ" },
      { label: "キャラクター作成・レビュー投稿" },
      { label: "PLAY：フレンドの卓にゲスト参加" },
      { label: "日程調整（基本）" },
      { label: `作品の出品（手数料 ${BASIC_PCT}%）` },
    ],
  },
  {
    plan: "play",
    icon: Gamepad2,
    tagline: "もっと遊ぶ人へ",
    featured: true,
    perks: [
      { label: "基本のすべて" },
      { label: "PLAY 解放：自分で卓を立てる（ホスト）", star: true },
      { label: "BGM・カットイン・ウィジェット等の全 PLAY 機能" },
      { label: "フレンド無制限" },
    ],
  },
  {
    plan: "pro",
    icon: Star,
    tagline: "作る人・上級者へ",
    perks: [
      { label: "プレイのすべて" },
      {
        label: `出品手数料を ${PRO_PCT}% に優遇（${BASIC_PCT - PRO_PCT}%お得）`,
        star: true,
      },
      { label: "日程調整 強化（無制限＋空き時間レコメンド）", soon: true },
      { label: "卓・キャラシのクラウド保存", soon: true },
      { label: "ストア優先表示・詳細アナリティクス", soon: true },
      { label: "Pro バッジ", soon: true },
    ],
  },
];

export default async function PricingPage() {
  const user = await getCurrentUser();
  const currentPlan = user?.plan ?? null;
  const billingConfigured = isPlanBillingConfigured();

  return (
    <>
      <TopHeader />

      {/* ヒーロー: ブランドのスカイ→シアンを背景に、ハイライト付きの大見出し。 */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-sky-50 to-background">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-cyan-200/40 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl"
        />
        <div className="mx-auto w-full max-w-screen-2xl px-4 pb-10 pt-6 sm:px-6">
          <Breadcrumb items={[{ label: "料金プラン" }]} />
          <div className="relative mt-6 text-center">
            <Sparkles
              className="absolute left-[18%] top-0 hidden h-7 w-7 text-cyan-400 sm:block"
              aria-hidden
            />
            <Sparkles
              className="absolute right-[18%] top-2 hidden h-5 w-5 text-sky-400 sm:block"
              aria-hidden
            />
            <p className="text-sm font-bold tracking-widest text-sky-600">
              Re-dice
            </p>
            <h1 className="relative mt-1 inline-block text-4xl font-black tracking-tight sm:text-5xl">
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-1.5 -z-10 h-3.5 rounded bg-sky-200/70"
              />
              料金プラン
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
              まずは無料で。遊ぶなら「プレイ」、作る・もっと使うなら「Pro」。
            </p>
            {currentPlan && (
              <p className="mt-2 text-xs text-muted-foreground">
                現在のプラン：
                <span className="font-semibold text-foreground">
                  {PLAN_LABEL[currentPlan]}
                  {currentPlan === "basic" && "（無料）"}
                </span>
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-screen-2xl px-4 py-10 sm:px-6">
        {/* テスター期間の注記: 課金未構成(env 未設定)時のみ表示 */}
        {!billingConfigured && (
          <div className="mx-auto max-w-3xl rounded-lg border border-amber-300/60 bg-amber-50/70 px-4 py-2.5 text-center text-xs text-amber-900">
            テスト期間中です。プランを選んでも<strong>料金は発生しません</strong>
            （動作確認用）。自動決済は準備中です。
          </div>
        )}

        <div className="mx-auto mt-8 grid max-w-5xl items-stretch gap-5 sm:grid-cols-3">
          {PLANS.map((p) => (
            <PlanCard
              key={p.plan}
              plan={p.plan}
              Icon={p.icon}
              tagline={p.tagline}
              perks={p.perks}
              featured={p.featured}
              current={currentPlan === p.plan}
              loggedIn={Boolean(user)}
              billingConfigured={billingConfigured}
            />
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-4xl text-center text-[11px] leading-relaxed text-muted-foreground">
          手数料の優遇は先行して有効です（運営が Pro を付与）。「プレイ」の PLAY
          解放や「予定」の特典、月額の自動決済は順次提供します。価格・特典は変更される場合があります。
        </p>
      </div>
    </>
  );
}

function PlanCard({
  plan,
  Icon,
  tagline,
  perks,
  featured,
  current,
  loggedIn,
  billingConfigured,
}: {
  plan: UserPlan;
  Icon: typeof Sparkles;
  tagline: string;
  perks: Perk[];
  featured?: boolean;
  current?: boolean;
  loggedIn: boolean;
  billingConfigured: boolean;
}) {
  const price = PLAN_PRICE_JPY[plan];
  const t = THEME[plan];

  return (
    <div
      className={[
        "relative flex flex-col rounded-2xl border-2 bg-card p-6 shadow-sm transition",
        t.border,
        featured ? "shadow-lg ring-2 ring-sky-200 sm:-translate-y-1" : "",
      ].join(" ")}
    >
      {featured && (
        <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-sky-600 px-3 py-1 text-[10px] font-bold text-white shadow">
          <Crown className="h-3 w-3" aria-hidden /> おすすめ
        </span>
      )}

      {/* 見出し: 大文字コード + 日本語ラベル */}
      <div className="text-center">
        <p
          className={`inline-flex items-center gap-1.5 text-sm font-extrabold tracking-widest ${t.text}`}
        >
          <Icon className="h-4 w-4" aria-hidden />
          {t.code}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {PLAN_LABEL[plan]}
          {current && (
            <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              現在
            </span>
          )}
        </p>
      </div>

      {/* 価格 */}
      <div className="mt-4 text-center">
        {price === 0 ? (
          <span className={`text-5xl font-black ${t.text}`}>無料</span>
        ) : (
          <span className="inline-flex items-baseline gap-0.5">
            <span className="text-2xl font-bold text-muted-foreground">¥</span>
            <span className={`text-5xl font-black ${t.text}`}>
              {price.toLocaleString("ja-JP")}
            </span>
            <span className="text-sm font-semibold text-muted-foreground">
              /月
            </span>
          </span>
        )}
        <p className="mt-1 text-[11px] text-muted-foreground">{tagline}</p>
      </div>

      {/* 特典リスト(丸いチェックバッジ) */}
      <ul className="mt-6 grow space-y-3">
        {perks.map((perk) => (
          <li key={perk.label} className="flex items-start gap-2.5 text-sm">
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white ${
                perk.star ? "bg-amber-500" : t.check
              }`}
            >
              <Check className="h-3 w-3" aria-hidden strokeWidth={3} />
            </span>
            <span
              className={
                perk.star ? "font-semibold text-foreground" : "text-foreground/90"
              }
            >
              {perk.label}
              {perk.soon && (
                <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  予定
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        <PlanSelectButton
          plan={plan}
          current={!!current}
          loggedIn={loggedIn}
          accentClassName={t.btn}
          billingConfigured={billingConfigured}
        />
      </div>
    </div>
  );
}

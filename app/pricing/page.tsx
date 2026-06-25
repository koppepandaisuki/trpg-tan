import { Check, Crown, Gamepad2, Sparkles, Star } from "lucide-react";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/session/get-user";
import { PLATFORM_FEE_RATE, PRO_PLATFORM_FEE_RATE } from "@/lib/stripe/fees";
import { PLAN_LABEL, PLAN_PRICE_JPY, type UserPlan } from "@/lib/plan";
import { PlanSelectButton } from "@/components/plan/plan-select-button";

export const metadata = {
  title: "料金プラン",
  description:
    "パラDa-iCE の料金プラン。基本（無料）/ プレイ（PLAY解放）/ Pro（手数料優遇など）の3段階。",
};

const BASIC_PCT = Math.round(PLATFORM_FEE_RATE * 100);
const PRO_PCT = Math.round(PRO_PLATFORM_FEE_RATE * 100);

type Perk = { label: string; soon?: boolean; star?: boolean };

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
      { label: `出品手数料を ${PRO_PCT}% に優遇（${BASIC_PCT - PRO_PCT}%お得）`, star: true },
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

  return (
    <>
      <TopHeader />
      <PageContainer className="py-10">
        <Breadcrumb items={[{ label: "料金プラン" }]} />

        <header className="mt-4 space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight">料金プラン</h1>
          <p className="text-sm text-muted-foreground">
            まずは無料で。遊ぶなら「プレイ」、作る・もっと使うなら「Pro」。
          </p>
          {currentPlan && (
            <p className="text-xs text-muted-foreground">
              現在のプラン：
              <span className="font-semibold text-foreground">
                {PLAN_LABEL[currentPlan]}
                {currentPlan === "basic" && "（無料）"}
              </span>
            </p>
          )}
        </header>

        {/* テスター期間中の注記(課金は発生しない) */}
        <div className="mx-auto mt-5 max-w-3xl rounded-md border border-amber-300/60 bg-amber-50/60 px-4 py-2.5 text-center text-xs text-amber-900">
          テスト期間中です。プランを選んでも<strong>料金は発生しません</strong>
          （動作確認用）。自動決済は準備中です。
        </div>

        <div className="mx-auto mt-8 grid max-w-5xl items-start gap-4 sm:grid-cols-3">
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
            />
          ))}
        </div>

        <p className="mx-auto mt-6 max-w-4xl text-center text-[11px] leading-relaxed text-muted-foreground">
          手数料の優遇は先行して有効です（運営が Pro を付与）。「プレイ」の
          PLAY 解放や「予定」の特典、月額の自動決済は順次提供します。価格・特典は
          変更される場合があります。
        </p>
      </PageContainer>
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
}: {
  plan: UserPlan;
  Icon: typeof Sparkles;
  tagline: string;
  perks: Perk[];
  featured?: boolean;
  current?: boolean;
  loggedIn: boolean;
}) {
  const price = PLAN_PRICE_JPY[plan];
  const isPro = plan === "pro";
  return (
    <Card
      className={
        featured
          ? "relative border-2 border-sky-400/70 bg-gradient-to-br from-sky-500/8 via-transparent to-emerald-500/8"
          : isPro
            ? "relative border-2 border-violet-400/60 bg-gradient-to-br from-violet-500/8 via-transparent to-sky-500/8"
            : "border-border"
      }
    >
      {featured && (
        <span className="absolute -top-2.5 left-5 inline-flex items-center gap-1 rounded-full bg-sky-600 px-2.5 py-0.5 text-[10px] font-bold text-white">
          <Crown className="h-3 w-3" aria-hidden /> 遊ぶ人に人気
        </span>
      )}
      <CardContent className="space-y-4 py-6">
        <div className="space-y-1">
          <div
            className={`inline-flex items-center gap-2 text-sm font-semibold ${
              featured ? "text-sky-700" : isPro ? "text-violet-700" : "text-muted-foreground"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {PLAN_LABEL[plan]}
            {current && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                現在
              </span>
            )}
          </div>
          <p className="text-2xl font-bold tracking-tight">
            {price === 0 ? (
              "無料"
            ) : (
              <>
                ¥{price.toLocaleString("ja-JP")}
                <span className="text-sm font-medium text-muted-foreground">
                  {" "}
                  / 月
                </span>
              </>
            )}
          </p>
          <p className="text-[11px] text-muted-foreground">{tagline}</p>
        </div>
        <ul className="space-y-2">
          {perks.map((perk) => (
            <li key={perk.label} className="flex items-start gap-2 text-sm">
              <Check
                className={`mt-0.5 h-4 w-4 shrink-0 ${
                  perk.star
                    ? "text-amber-500"
                    : isPro
                      ? "text-violet-600"
                      : featured
                        ? "text-sky-600"
                        : "text-emerald-600"
                }`}
                aria-hidden
              />
              <span className={perk.star ? "font-medium text-foreground" : "text-foreground/90"}>
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
        <div className="pt-1">
          <PlanSelectButton plan={plan} current={!!current} loggedIn={loggedIn} />
        </div>
      </CardContent>
    </Card>
  );
}

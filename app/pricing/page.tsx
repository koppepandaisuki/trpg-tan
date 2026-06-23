import Link from "next/link";
import type { Route } from "next";
import { Check, Crown, Sparkles, Star } from "lucide-react";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/session/get-user";
import { PLATFORM_FEE_RATE, PRO_PLATFORM_FEE_RATE } from "@/lib/stripe/fees";

export const metadata = {
  title: "料金プラン",
  description:
    "パラDa-iCE の基本プラン（無料）と Pro プラン。Pro は出品手数料の優遇や日程調整の強化など、作る人・遊ぶ人どちらにも特典があります。",
};

const BASIC_PCT = Math.round(PLATFORM_FEE_RATE * 100);
const PRO_PCT = Math.round(PRO_PLATFORM_FEE_RATE * 100);

/** Pro 月額(予定)。自動決済の実装後に確定。 */
const PRO_PRICE_JPY = 980;

type Perk = { label: string; soon?: boolean };

const BASIC_PERKS: Perk[] = [
  { label: `作品の出品（手数料 ${BASIC_PCT}%）` },
  { label: "購入・ダウンロード・PLAY・レビュー" },
  { label: "日程調整（基本機能）" },
  { label: "フレンド・通知" },
];

const PRO_PERKS: Perk[] = [
  { label: `出品手数料を ${PRO_PCT}% に優遇（${BASIC_PCT - PRO_PCT}%お得）` },
  { label: "日程調整：無制限＋空き時間レコメンド＋リマインド", soon: true },
  { label: "卓・キャラシのクラウド保存（端末間バックアップ）", soon: true },
  { label: "ストアでの優先表示", soon: true },
  { label: "詳細アナリティクス", soon: true },
  { label: "Pro バッジ", soon: true },
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
            まずは無料で。もっと作る・遊ぶなら Pro
            で手数料優遇やツール強化が受けられます。
          </p>
          {currentPlan && (
            <p className="text-xs text-muted-foreground">
              現在のプラン：
              <span className="font-semibold text-foreground">
                {currentPlan === "pro" ? "Pro" : "基本（無料）"}
              </span>
            </p>
          )}
        </header>

        <div className="mx-auto mt-8 grid max-w-3xl gap-4 sm:grid-cols-2">
          {/* 基本 */}
          <Card className="border-border">
            <CardContent className="space-y-4 py-6">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <Sparkles className="h-4 w-4" aria-hidden />
                  基本
                </div>
                <p className="text-2xl font-bold tracking-tight">無料</p>
              </div>
              <ul className="space-y-2">
                {BASIC_PERKS.map((p) => (
                  <PerkRow key={p.label} perk={p} tone="muted" />
                ))}
              </ul>
              <p className="text-[11px] text-muted-foreground">
                すべての基本機能を無料で使えます。
              </p>
            </CardContent>
          </Card>

          {/* Pro（強調） */}
          <Card className="relative border-2 border-sky-400/70 bg-gradient-to-br from-sky-500/8 via-transparent to-emerald-500/8">
            <span className="absolute -top-2.5 left-5 inline-flex items-center gap-1 rounded-full bg-sky-600 px-2.5 py-0.5 text-[10px] font-bold text-white">
              <Crown className="h-3 w-3" aria-hidden /> おすすめ
            </span>
            <CardContent className="space-y-4 py-6">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700">
                  <Star className="h-4 w-4" aria-hidden />
                  Pro
                </div>
                <p className="text-2xl font-bold tracking-tight">
                  ¥{PRO_PRICE_JPY.toLocaleString("ja-JP")}
                  <span className="text-sm font-medium text-muted-foreground">
                    {" "}
                    / 月（予定）
                  </span>
                </p>
              </div>
              <ul className="space-y-2">
                {PRO_PERKS.map((p) => (
                  <PerkRow key={p.label} perk={p} tone="pro" />
                ))}
              </ul>
              <div className="rounded-md border border-sky-200 bg-sky-50/60 px-3 py-2 text-[11px] leading-relaxed text-sky-900">
                手数料の優遇は<strong>先行して有効</strong>です（運営が Pro
                を付与）。月額の自動決済は準備中で、整い次第ここから加入できる
                ようになります。
              </div>
            </CardContent>
          </Card>
        </div>

        <p className="mx-auto mt-6 max-w-3xl text-center text-[11px] text-muted-foreground">
          記載の価格・特典は予定であり、変更される場合があります。「予定」の
          特典は順次提供します。
        </p>
      </PageContainer>
    </>
  );
}

function PerkRow({ perk, tone }: { perk: Perk; tone: "muted" | "pro" }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <Check
        className={`mt-0.5 h-4 w-4 shrink-0 ${
          tone === "pro" ? "text-sky-600" : "text-emerald-600"
        }`}
        aria-hidden
      />
      <span className="text-foreground/90">
        {perk.label}
        {perk.soon && (
          <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            予定
          </span>
        )}
      </span>
    </li>
  );
}

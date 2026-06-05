import Link from "next/link";
import type { Route } from "next";
import { AlertCircle, ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Stripe 接続が未完了の creator に、案内 + ワンクリック接続ボタンを
 * 出す共通カード(AAAAAA)。投稿ページ / 編集ページの両方で使う。
 *
 * 文言は alphaFreeAllowed(無料公開を Connect 未完了でも許可するか)で
 * 分岐する。amber トーンで「やるべきこと」の注意喚起として表示。
 *
 * Server Component(状態なし)。stripeChargesEnabled が true のときは
 * 呼び出し側で出さない判断をする(本 component 自体は常に描画する)。
 */
export function StripeConnectNotice({
  alphaFreeAllowed,
  className,
}: {
  alphaFreeAllowed: boolean;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-amber-200 bg-amber-50/60 p-5",
        className,
      )}
    >
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-300 bg-amber-100 text-amber-800">
            <AlertCircle className="h-5 w-5" aria-hidden />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold tracking-tight text-amber-900">
              Stripe 接続が未完了です
            </p>
            <p className="text-xs leading-relaxed text-amber-900/80">
              {alphaFreeAllowed
                ? "価格 ¥0(無料)の作品は今すぐ公開できますが、有料販売には Stripe 接続(受取口座の設定)が必要です。"
                : "作品を公開するには Stripe 接続(受取口座の設定)を完了する必要があります。"}
            </p>
          </div>
        </div>
        <Link
          href={"/creator/onboarding" as Route}
          className={cn(
            buttonVariants({ variant: "primary", size: "sm" }),
            "shrink-0",
          )}
        >
          Stripe 接続を設定
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}

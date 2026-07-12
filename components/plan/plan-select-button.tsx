"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  selectPlanTesterAction,
  startCheckoutAction,
  openPortalAction,
} from "@/app/pricing/actions";
import type { UserPlan } from "@/lib/plan";

/**
 * /pricing の各プランの選択ボタン。
 *
 * - billingConfigured=true のとき: pay/pro → Stripe Checkout にリダイレクト。
 *   構成済みでも not_configured が返ったらテスター切替にフォールバック。
 * - billingConfigured=false のとき: テスター用の課金なし切替。
 * - 利用中プランが paid のとき: 「契約を管理」でカスタマーポータルへ。
 * - basic カードは downgrade ボタンを出さない(ポータル経由で解約)。
 */
export function PlanSelectButton({
  plan,
  current,
  loggedIn,
  accentClassName = "bg-red-600 hover:bg-red-700",
  billingConfigured = false,
}: {
  plan: UserPlan;
  current: boolean;
  loggedIn: boolean;
  accentClassName?: string;
  billingConfigured?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!loggedIn) {
    return (
      <a
        href="/login?next=/pricing"
        className="inline-flex w-full items-center justify-center rounded-lg border border-border px-3 py-2.5 text-sm font-semibold transition hover:bg-muted"
      >
        ログインして選択
      </a>
    );
  }

  if (current) {
    return (
      <div className="space-y-2">
        <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-2.5 text-sm font-semibold text-muted-foreground">
          <Check className="h-4 w-4" aria-hidden />
          利用中
        </span>
        {plan !== "basic" && billingConfigured && (
          <button
            type="button"
            disabled={pending}
            className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground transition hover:bg-muted disabled:opacity-60"
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await openPortalAction();
                if (r && !r.ok) setError(r.error);
              })
            }
          >
            {pending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ExternalLink className="h-3 w-3" />
            )}
            契約を管理
          </button>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  // basic カードは downgrade ボタンを表示しない(ポータル経由で解約)。
  if (plan === "basic") {
    return null;
  }

  // play / pro: 課金構成済みなら Checkout、未構成ならテスター切替。
  return (
    <div className="space-y-1.5">
      <button
        type="button"
        disabled={pending}
        className={cn(
          "inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-bold text-white shadow-sm transition disabled:opacity-60",
          accentClassName,
        )}
        onClick={() =>
          start(async () => {
            setError(null);
            if (billingConfigured) {
              const r = await startCheckoutAction(plan as "play" | "pro");
              // redirect() が成功したここには到達しない。
              if (r.reason === "not_configured") {
                const tr = await selectPlanTesterAction(plan);
                if (tr.ok) router.refresh();
                else setError(tr.error);
              } else {
                setError(r.error);
              }
            } else {
              const r = await selectPlanTesterAction(plan);
              if (r.ok) router.refresh();
              else setError(r.error);
            }
          })
        }
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        このプランにする
      </button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { selectPlanTesterAction } from "@/app/pricing/actions";
import type { UserPlan } from "@/lib/plan";

/**
 * /pricing の各プランの「このプランにする」ボタン(テスター用・課金なし)。
 * 押すと selectPlanTesterAction でプランを切替え、router.refresh で反映。
 * accentClassName でプランごとの色(bg/hover)を渡せる。
 */
export function PlanSelectButton({
  plan,
  current,
  loggedIn,
  accentClassName = "bg-sky-600 hover:bg-sky-700",
}: {
  plan: UserPlan;
  current: boolean;
  loggedIn: boolean;
  accentClassName?: string;
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
      <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-2.5 text-sm font-semibold text-muted-foreground">
        <Check className="h-4 w-4" aria-hidden />
        利用中
      </span>
    );
  }

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
            const r = await selectPlanTesterAction(plan);
            if (r.ok) router.refresh();
            else setError(r.error);
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

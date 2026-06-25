"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { selectPlanTesterAction } from "@/app/pricing/actions";
import type { UserPlan } from "@/lib/plan";

/**
 * /pricing の各プランの「このプランにする」ボタン(テスター用・課金なし)。
 * 押すと selectPlanTesterAction でプランを切替え、router.refresh で反映。
 */
export function PlanSelectButton({
  plan,
  current,
  loggedIn,
}: {
  plan: UserPlan;
  current: boolean;
  loggedIn: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!loggedIn) {
    return (
      <a
        href="/login?next=/pricing"
        className="inline-flex w-full items-center justify-center rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
      >
        ログインして選択
      </a>
    );
  }

  if (current) {
    return (
      <Button variant="outline" size="sm" className="w-full gap-1.5" disabled>
        <Check className="h-4 w-4" aria-hidden />
        利用中
      </Button>
    );
  }

  return (
    <div className="space-y-1.5">
      <Button
        variant="primary"
        size="sm"
        className="w-full"
        disabled={pending}
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
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

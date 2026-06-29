"use client";

import * as React from "react";
import { Loader2, ArrowLeftCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * 決済成功/キャンセル画面でデスクトップアプリに戻る導線。
 *
 *  - paradice:// deep link を発火してアプリに通知する
 *  - 1.2 秒待っても可視のままなら、戻れなかった可能性が高いので
 *    手動の「アプリに戻る」ボタンを表示する(ブラウザにより
 *    deep link 自動起動はブロックされうるため)。
 *  - 親ページは return_to=desktop の時だけこのコンポーネントを置く。
 */
export function ReturnToDesktop({
  kind,
  sessionId,
  slug,
  subPlan,
}: {
  kind: "complete" | "cancel";
  sessionId?: string;
  slug?: string;
  subPlan?: string;
}) {
  const [autoTried, setAutoTried] = React.useState(false);

  const href = React.useMemo(() => {
    if (subPlan) {
      return `paradice://subscription/complete?plan=${subPlan}`;
    }
    const q = new URLSearchParams();
    if (sessionId) q.set("session_id", sessionId);
    if (slug) q.set("slug", slug);
    const qs = q.toString();
    return `paradice://purchase/${kind}${qs ? `?${qs}` : ""}`;
  }, [kind, sessionId, slug, subPlan]);

  React.useEffect(() => {
    // ブラウザのポップアップブロックに引っかからない手段で発火。
    window.location.href = href;
    const t = window.setTimeout(() => setAutoTried(true), 1200);
    return () => window.clearTimeout(t);
  }, [href]);

  return (
    <div className="relative z-10 flex w-full flex-col items-center gap-2 pt-2 sm:max-w-xs">
      {!autoTried ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          デスクトップアプリに戻ります…
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            自動で戻れなかった場合は下のボタンを押してください。
          </p>
          <a
            href={href}
            className={cn(
              buttonVariants({ variant: "primary" }),
              "w-full inline-flex items-center justify-center gap-2",
            )}
          >
            <ArrowLeftCircle className="h-4 w-4" />
            アプリに戻る
          </a>
        </>
      )}
    </div>
  );
}

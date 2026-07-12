"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * ブラウザ/PWA 版アプリ(/app/)へセッションを受け渡す中継ページ。
 * /auth/desktop-handoff のブラウザ版。
 *
 * フロー(apps/desktop/src/auth.ts の initBrowserHandoffAuth と対):
 *  1. PWA が `/login?next=/auth/app-handoff` へ遷移してログイン。
 *  2. ここに着地したら、現在のセッションの access/refresh トークンを
 *     `/app/#access_token=…&refresh_token=…&type=app-handoff` に載せて
 *     リダイレクト。
 *  3. PWA が起動時にフラグメントを読んで setSession → URL から即消す。
 *
 * トークンはフラグメント(#)に載るためサーバーへは送られない。
 * 同一オリジンなのでネットワークも跨がない。
 */
export default function AppHandoffPage() {
  const [phase, setPhase] = React.useState<"checking" | "no-session">(
    "checking",
  );

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!alive) return;
      if (!session?.access_token || !session?.refresh_token) {
        setPhase("no-session");
        return;
      }
      const frag = new URLSearchParams({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        type: "app-handoff",
      });
      window.location.replace(`/app/#${frag.toString()}`);
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-red-300 bg-red-50 text-red-700">
        {phase === "checking" ? (
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        ) : (
          <LogIn className="h-6 w-6" aria-hidden />
        )}
      </div>

      {phase === "checking" && (
        <div className="space-y-1">
          <h1 className="flex items-center justify-center gap-2 text-lg font-semibold">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />
            アプリに戻っています…
          </h1>
          <p className="text-sm text-muted-foreground">少々お待ちください。</p>
        </div>
      )}

      {phase === "no-session" && (
        <div className="space-y-3">
          <h1 className="text-lg font-semibold">ログインが必要です</h1>
          <p className="text-sm text-muted-foreground">
            セッションが見つかりませんでした。もう一度ログインしてください。
          </p>
          <Link
            href={`/login?next=${encodeURIComponent("/auth/app-handoff")}`}
            className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background"
          >
            <LogIn className="h-4 w-4" />
            ログインへ
          </Link>
        </div>
      )}
    </main>
  );
}

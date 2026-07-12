"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, LogIn, MonitorSmartphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * デスクトップアプリへセッションを受け渡す中継ページ。
 *
 * フロー(auth.ts と対):
 *  1. アプリが `${WEB}/login?next=/auth/desktop-handoff` をブラウザで開く。
 *  2. ユーザーがログイン(メール/パス or Google)→ ここに着地。
 *     (既にログイン済みなら login ページが即ここへ飛ばす)
 *  3. 現在のセッションの access/refresh トークンを
 *     `redice://auth/callback#access_token=…&refresh_token=…` に載せて
 *     deep-link を起動 → アプリ側が setSession で受け取る。
 *     (アプリは旧 paradice:// も受理するが、発行は新スキームに統一)
 *
 * これにより 1 回のログインで「ブラウザ(web の Cookie)」と
 * 「アプリ(WebView の localStorage)」の両方がログイン済みになる。
 *
 * トークンはフラグメント(#)に載るためサーバーには送られず、deep-link は
 * OS 内でアプリへ直接渡る(ネットワークを経由しない)。
 */

const DEEP_LINK = "redice://auth/callback";

type Phase = "checking" | "ready" | "no-session";

export default function DesktopHandoffPage() {
  const [phase, setPhase] = React.useState<Phase>("checking");
  const [deepLink, setDeepLink] = React.useState<string | null>(null);

  const launch = React.useCallback((url: string) => {
    // location 代入で OS の deep-link ハンドラ(アプリ)を起動。
    window.location.href = url;
  }, []);

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
        type: "desktop-handoff",
      });
      const url = `${DEEP_LINK}#${frag.toString()}`;
      setDeepLink(url);
      setPhase("ready");
      // 自動でアプリ起動を試みる(ブロックされたら手動ボタンで)。
      launch(url);
    })();
    return () => {
      alive = false;
    };
  }, [launch]);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-red-300 bg-red-50 text-red-700">
        {phase === "checking" ? (
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        ) : phase === "ready" ? (
          <CheckCircle2 className="h-6 w-6 text-emerald-600" aria-hidden />
        ) : (
          <LogIn className="h-6 w-6" aria-hidden />
        )}
      </div>

      {phase === "checking" && (
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">セッションを確認しています…</h1>
          <p className="text-sm text-muted-foreground">少々お待ちください。</p>
        </div>
      )}

      {phase === "ready" && (
        <div className="space-y-3">
          <h1 className="text-lg font-semibold">ログインが完了しました</h1>
          <p className="text-sm text-muted-foreground">
            アプリに戻っています。自動で戻らない場合は下のボタンを押してください。
            このタブは閉じて構いません。
          </p>
          {deepLink && (
            <button
              type="button"
              onClick={() => launch(deepLink)}
              className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background"
            >
              <MonitorSmartphone className="h-4 w-4" />
              アプリを開く
            </button>
          )}
        </div>
      )}

      {phase === "no-session" && (
        <div className="space-y-3">
          <h1 className="text-lg font-semibold">ログインが必要です</h1>
          <p className="text-sm text-muted-foreground">
            セッションが見つかりませんでした。もう一度ログインしてください。
          </p>
          <Link
            href={`/login?next=${encodeURIComponent("/auth/desktop-handoff")}`}
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

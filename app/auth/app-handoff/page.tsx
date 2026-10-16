"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, LogIn } from "lucide-react";
import { buildAppHandoffFragment } from "@/lib/auth/app-handoff";

/**
 * ブラウザ/PWA 版アプリ(/app/)へセッションを受け渡す中継ページ。
 * /auth/desktop-handoff のブラウザ版。
 *
 * フロー(apps/desktop/src/auth.ts の initBrowserHandoffAuth と対):
 *  1. PWA が `/login?next=/auth/app-handoff` へ遷移してログイン。
 *  2. ここに着地したら、1 回限りのログイン用コード(token_hash)を発行してもらい
 *     `/app/#token_hash=…&type=app-handoff` に載せてリダイレクト
 *     (lib/auth/app-handoff.ts。Web と refresh トークンを共有しないため)。
 *  3. PWA が起動時にフラグメントを読んで verifyOtp → URL から即消す。
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
      const frag = await buildAppHandoffFragment("app-handoff");
      if (!alive) return;
      if (!frag) {
        setPhase("no-session");
        return;
      }
      window.location.replace(`/app/#${frag}`);
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-ink text-white">
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

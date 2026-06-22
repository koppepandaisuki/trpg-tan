"use client";

import * as React from "react";
import { Sparkles, Loader2, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * 「クリエイターになる」申請カード(ストアトップ用)。
 *
 * 未ログイン                  → ログインボタンを出す
 * ログイン済み・未 creator    → 「申請する」ボタン → Stripe Express onboarding へ遷移
 * 既に creator (or admin)     → 何も表示しない(親の条件分岐で非表示にする)
 *
 * Stripe 連携完了 + charges_enabled=true で initial 申請が承認扱いになり、
 * webhook が profiles.is_creator=true を立てる(lib/mutations/creator-connect.ts)。
 */
export function CreatorApplyCta({
  isLoggedIn,
}: {
  /** ログイン済みかどうか。サーバ側で渡す。 */
  isLoggedIn: boolean;
}) {
  const [status, setStatus] = React.useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [message, setMessage] = React.useState<string | null>(null);

  async function apply() {
    if (status === "loading") return;
    setStatus("loading");
    setMessage(null);
    try {
      const res = await fetch("/api/stripe/connect/onboarding-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = (await res.json().catch(() => null)) as
        | { ok: true; url: string }
        | { ok: false; message?: string }
        | null;
      if (!res.ok || !data || !("ok" in data) || !data.ok) {
        setStatus("error");
        setMessage(
          (data && "message" in data && data.message) ||
            "申請を開始できませんでした",
        );
        return;
      }
      window.location.href = data.url;
    } catch {
      setStatus("error");
      setMessage("申請を開始できませんでした");
    }
  }

  return (
    <Card className="overflow-hidden border-border bg-gradient-to-br from-sky-500/10 via-transparent to-sky-500/5">
      <CardContent className="flex flex-col items-center gap-3 p-6 text-center sm:flex-row sm:items-start sm:text-left">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-sky-300 bg-sky-50 text-sky-700">
          <Sparkles className="h-5 w-5" aria-hidden />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold tracking-tight">
            あなたの作品をストアで販売する
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            シナリオ・ルールブック・素材などを公開できます。本人確認と入金口座の
            登録には Stripe Express(無料)を使います。
          </p>
          {message && (
            <p role="alert" className="mt-2 text-xs text-destructive">
              {message}
            </p>
          )}
        </div>
        {isLoggedIn ? (
          <Button
            type="button"
            onClick={() => void apply()}
            disabled={status === "loading"}
            className="shrink-0"
          >
            {status === "loading" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4" />
            )}
            クリエイター申請を始める
          </Button>
        ) : (
          <a
            href="/login?next=/store"
            className="shrink-0 text-sm font-medium text-primary hover:underline"
          >
            ログインして始める →
          </a>
        )}
      </CardContent>
    </Card>
  );
}

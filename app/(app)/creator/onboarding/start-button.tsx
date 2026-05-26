"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Stripe onboarding 開始ボタン (Client Component)。
 *
 * /api/stripe/connect/onboarding-link を POST し、返ってきた URL に
 * window.location.href でリダイレクトする。エラーは inline 表示。
 *
 * D-020 PR2: ナビゲーション以外の UX(プログレス、再試行、キャンセル等)は
 * 意図的に最小化。MVP 範囲を広げない。
 */
export function OnboardingStartButton({ label }: { label: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/connect/onboarding-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = (await res.json()) as { ok?: boolean; url?: string; message?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.message ?? "リクエストに失敗しました");
      }
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "予期せぬエラーが発生しました");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={start} disabled={loading} variant="primary">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {label}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

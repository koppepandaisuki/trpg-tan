"use client";

import * as React from "react";
import { Loader2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BuyButtonProps {
  productId: string;
  label?: string;
}

/**
 * Buy button — POST /api/checkout, then same-tab redirect to Stripe.
 *
 * Mirrors the Phase 6 DownloadButton patterns:
 *   - Double-click guard via inFlight ref
 *   - Content-Type guard against accidental HTML responses
 *   - Status-specific messages for 401 and "already_purchased"
 */
export function BuyButton({ productId, label = "今すぐ購入" }: BuyButtonProps) {
  const [status, setStatus] = React.useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const inFlight = React.useRef(false);

  async function onClick() {
    if (inFlight.current) return;
    inFlight.current = true;
    setStatus("loading");
    setError(null);

    // デスクトップアプリから来た場合、success/cancel で redice:// に
    // 戻れるよう checkout API へヒントを渡す(?from=desktop を URL に
    // 付けて遷移してきたケースを拾う)。
    const fromDesktop =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("from") === "desktop";

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          ...(fromDesktop ? { returnTo: "desktop" } : {}),
        }),
      });

      const contentType = res.headers.get("content-type") ?? "";
      const isJson = contentType.includes("application/json");
      if (!isJson) {
        setStatus("error");
        setError(
          res.status === 401
            ? "ログインが必要です。再度ログインしてください"
            : "購入処理を開始できませんでした",
        );
        inFlight.current = false;
        return;
      }

      const data = (await res.json().catch(() => null)) as
        | { ok: true; url: string }
        | { ok: false; message: string; reason?: string }
        | null;

      if (!res.ok || !data || !("ok" in data) || !data.ok) {
        setStatus("error");
        if (res.status === 401) {
          setError("ログインが必要です。再度ログインしてください");
        } else if (data && "reason" in data && data.reason === "already_purchased") {
          setError("すでに購入済みです。ライブラリからご利用ください");
        } else {
          setError(
            (data && "message" in data && data.message) ||
              "購入処理を開始できませんでした",
          );
        }
        inFlight.current = false;
        return;
      }

      window.location.href = data.url;
      // Do not reset inFlight — navigation is in progress.
    } catch {
      setStatus("error");
      setError("購入処理を開始できませんでした");
      inFlight.current = false;
    }
  }

  const isLoading = status === "loading";

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        onClick={onClick}
        disabled={isLoading}
        className="w-full"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            準備中…
          </>
        ) : (
          <>
            <ShoppingCart className="h-4 w-4" />
            {label}
          </>
        )}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

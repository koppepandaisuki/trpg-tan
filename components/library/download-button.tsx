"use client";

import * as React from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DownloadButtonProps {
  productId: string;
  productTitle: string;
  /** Disable for "no_file" / "suspended" / "blocked" availability. */
  disabled?: boolean;
  /** Override the visible label (e.g. "閲覧"). */
  label?: string;
}

type Status = "idle" | "loading" | "error";

/**
 * Initiates a download by POSTing to /api/library/[productId]/download
 * and navigating the current tab to the returned signed URL.
 *
 * Phase 6 contract:
 *   - Same-tab redirect (no window.open).
 *   - Loading state while the request is in flight.
 *   - Double-click protection via local `inFlight` state.
 *   - Generic error message — never expose the server's reason code.
 */
export function DownloadButton({
  productId,
  productTitle,
  disabled,
  label = "ダウンロード",
}: DownloadButtonProps) {
  const [status, setStatus] = React.useState<Status>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const inFlight = React.useRef(false);

  async function onClick() {
    if (inFlight.current || disabled) return;
    inFlight.current = true;
    setStatus("loading");
    setError(null);

    try {
      const res = await fetch(`/api/library/${productId}/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Send empty body — the productId is in the path.
        body: JSON.stringify({}),
      });

      // Defensive: if middleware ever redirects to a HTML page, fetch may
      // follow it and we'd get an HTML body. Refuse anything that is not
      // JSON before we try to parse it.
      const contentType = res.headers.get("content-type") ?? "";
      const isJson = contentType.includes("application/json");

      if (!isJson) {
        setStatus("error");
        setError(
          res.status === 401
            ? "ログインが必要です。再度ログインしてください"
            : "ダウンロードを開始できませんでした",
        );
        inFlight.current = false;
        return;
      }

      const data = (await res.json().catch(() => null)) as
        | { ok: true; url: string }
        | { ok: false; message: string }
        | null;

      if (!res.ok || !data || !("ok" in data) || !data.ok) {
        setStatus("error");
        // Surface 401 distinctly so the user knows to re-authenticate.
        // Other statuses keep the generic message from the server.
        if (res.status === 401) {
          setError("ログインが必要です。再度ログインしてください");
        } else {
          setError(
            (data && "message" in data && data.message) ||
              "ダウンロードを開始できませんでした",
          );
        }
        inFlight.current = false;
        return;
      }

      // Same-tab navigation as per Phase 6 spec.
      window.location.href = data.url;
      // Intentionally do not reset inFlight — we are navigating away.
    } catch {
      setStatus("error");
      setError("ダウンロードを開始できませんでした");
      inFlight.current = false;
    }
  }

  const isLoading = status === "loading";

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        onClick={onClick}
        disabled={disabled || isLoading}
        aria-label={`「${productTitle}」を${label}`}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            準備中…
          </>
        ) : (
          <>
            <Download className="h-4 w-4" />
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

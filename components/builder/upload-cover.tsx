"use client";

import * as React from "react";
import { Check, Loader2, RefreshCw, Upload as UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COVER_MAX_BYTES } from "@/lib/format/upload";

interface UploadCoverProps {
  productId: string;
  /** Parent uses this to disable save buttons while an upload is in flight. */
  onUploadingChange: (uploading: boolean) => void;
}

type Status = "idle" | "uploading" | "uploaded" | "error";

// Mirrors the server-side cover MIME allow-list (lib/format/upload.ts).
// Hardcoded here for the <input accept> attribute; client + server mismatch
// is caught by the server returning 400 invalid_mime.
const ACCEPT = "image/png,image/jpeg,image/webp";

export function UploadCover({
  productId,
  onUploadingChange,
}: UploadCoverProps) {
  const [status, setStatus] = React.useState<Status>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = React.useState<File | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const inFlight = React.useRef(false);

  function openPicker() {
    inputRef.current?.click();
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so re-selecting the same file fires `change` again.
    e.target.value = "";
    if (!file) return;
    if (inFlight.current) return;

    // Client-side early reject for size. The bucket setting is the real
    // gate; this just gives faster feedback.
    if (file.size > COVER_MAX_BYTES) {
      setStatus("error");
      setError(
        `ファイルサイズが上限(${formatBytes(COVER_MAX_BYTES)})を超えています(${formatBytes(file.size)})`,
      );
      return;
    }

    inFlight.current = true;
    setStatus("uploading");
    setError(null);
    onUploadingChange(true);

    try {
      // Step 1: ask server for a signed upload URL.
      const res = await fetch(
        `/api/products/${productId}/cover-upload-url`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentType: file.type }),
        },
      );
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("application/json")) {
        throw new Error(
          res.status === 401
            ? "ログインが必要です。再度ログインしてください"
            : "アップロードを開始できませんでした",
        );
      }
      const data = (await res.json().catch(() => null)) as
        | { ok: true; url: string; path: string }
        | { ok: false; message: string; reason?: string }
        | null;
      if (!res.ok || !data || !("ok" in data) || !data.ok) {
        throw new Error(
          (data && "message" in data && data.message) ||
            "アップロードを開始できませんでした",
        );
      }

      // Step 2: PUT the file body straight to Supabase Storage.
      const put = await fetch(data.url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) {
        throw new Error("アップロードに失敗しました。再度お試しください");
      }

      setUploadedFile(file);
      setStatus("uploaded");
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof Error
          ? err.message
          : "アップロードに失敗しました。再度お試しください",
      );
    } finally {
      inFlight.current = false;
      onUploadingChange(false);
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={onFileChange}
        aria-label="表紙画像を選択"
      />

      {status === "idle" && (
        <div className="space-y-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openPicker}
          >
            <UploadIcon className="h-4 w-4" />
            ファイルを選択
          </Button>
          <p className="text-xs text-muted-foreground">
            PNG / JPEG / WebP、最大 {formatBytes(COVER_MAX_BYTES)}
          </p>
        </div>
      )}

      {status === "uploading" && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          アップロード中…
        </div>
      )}

      {status === "uploaded" && uploadedFile && (
        <div className="flex flex-col gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
          <div className="flex flex-wrap items-center gap-2 text-emerald-800">
            <Check className="h-4 w-4 shrink-0" />
            <span className="font-medium break-all">{uploadedFile.name}</span>
            <span className="text-emerald-700">
              ({formatBytes(uploadedFile.size)})
            </span>
          </div>
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openPicker}
            >
              <RefreshCw className="h-4 w-4" />
              差し替える
            </Button>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
          <p role="alert" className="text-destructive">
            {error}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openPicker}
          >
            <RefreshCw className="h-4 w-4" />
            再アップロード
          </Button>
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

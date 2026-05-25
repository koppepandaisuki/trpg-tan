"use client";

import * as React from "react";
import { Check, Loader2, RefreshCw, Upload as UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRODUCT_FILE_MAX_BYTES } from "@/lib/format/upload";
import type { FileFormat } from "@/lib/queries/types";

interface UploadProductFileProps {
  productId: string;
  /**
   * The product's currently-selected file_format from the form. Determines
   * the `accept` filter shown to the user. The server re-validates against
   * the DB's stored file_format (the user may have changed the format in
   * the form without saving), so if the user uploads before saving they
   * may see a 400 invalid_mime — the hint text warns about this.
   */
  fileFormat: FileFormat;
  /** Parent uses this to disable save buttons while an upload is in flight. */
  onUploadingChange: (uploading: boolean) => void;
}

type Status = "idle" | "uploading" | "uploaded" | "error";

/**
 * <input accept> by file_format. Mirrors the server-side allow-list in
 * lib/format/upload.ts. Extensions (.zip etc) are included because some
 * browsers' file pickers don't honor application/zip alone.
 */
const ACCEPT_BY_FORMAT: Record<FileFormat, string> = {
  pdf: "application/pdf,.pdf",
  image_zip: "application/zip,.zip",
  audio: "audio/mpeg,audio/wav,.mp3,.wav",
};

const FORMAT_LABEL: Record<FileFormat, string> = {
  pdf: "PDF",
  image_zip: "画像 ZIP",
  audio: "音声 (MP3 / WAV)",
};

export function UploadProductFile({
  productId,
  fileFormat,
  onUploadingChange,
}: UploadProductFileProps) {
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
    e.target.value = "";
    if (!file) return;
    if (inFlight.current) return;

    if (file.size > PRODUCT_FILE_MAX_BYTES) {
      setStatus("error");
      setError(
        `ファイルサイズが上限(${formatBytes(PRODUCT_FILE_MAX_BYTES)})を超えています(${formatBytes(file.size)})`,
      );
      return;
    }

    inFlight.current = true;
    setStatus("uploading");
    setError(null);
    onUploadingChange(true);

    try {
      const res = await fetch(
        `/api/products/${productId}/file-upload-url`,
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
        accept={ACCEPT_BY_FORMAT[fileFormat]}
        className="sr-only"
        onChange={onFileChange}
        aria-label="作品ファイルを選択"
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
            {FORMAT_LABEL[fileFormat]}、最大{" "}
            {formatBytes(PRODUCT_FILE_MAX_BYTES)}
          </p>
          <p className="text-xs text-muted-foreground">
            ファイル形式を変更した場合は、先に「下書き保存」してから添付してください。
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

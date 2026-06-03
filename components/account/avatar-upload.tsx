"use client";

import * as React from "react";
import { Loader2, RefreshCw, Upload as UploadIcon, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AVATAR_MAX_BYTES } from "@/lib/format/upload";
import { updateAvatarPathAction } from "@/app/(app)/account/settings/actions";

/**
 * 自分のアバター画像アップロード UI。
 *
 * フロー(builder の UploadCover と同じパターン):
 *   1. ファイル選択 → サイズ検証
 *   2. POST /api/account/avatar-upload-url で signed URL 取得
 *   3. signed URL に PUT で画像をアップロード
 *   4. updateAvatarPathAction で profiles.avatar_path を更新
 *   5. 表示用 URL を新パスから組み立てて即時プレビュー反映
 *
 * 公開バケット(public-read)なので、表示には storage.publicUrl がそのまま
 * 使える。URL に timestamp が含まれるため、新規アップロード時のキャッシュ
 * バスティングは自動で効く。
 *
 * Props:
 *   initialUrl  — 現在の avatar 公開 URL(null なら placeholder)
 *   userId      — 自分の user_id(変更後の URL 再構築に必要)
 *   storageUrl  — Supabase の public storage URL(env から渡す)
 */

const ACCEPT = "image/png,image/jpeg,image/webp";
type Status = "idle" | "uploading" | "uploaded" | "error";

interface AvatarUploadProps {
  initialUrl: string | null;
  initialDisplayName: string;
}

export function AvatarUpload({
  initialUrl,
  initialDisplayName,
}: AvatarUploadProps) {
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(initialUrl);
  const [status, setStatus] = React.useState<Status>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const inFlight = React.useRef(false);

  const initial = (initialDisplayName || "?").charAt(0).toUpperCase();

  function openPicker() {
    inputRef.current?.click();
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (inFlight.current) return;

    // クライアント側の早期 reject。バケット設定が真のゲートだが、UI
    // 即応性を上げる。
    if (file.size > AVATAR_MAX_BYTES) {
      setStatus("error");
      setError(
        `画像サイズが上限(${formatBytes(AVATAR_MAX_BYTES)})を超えています(${formatBytes(file.size)})`,
      );
      return;
    }

    inFlight.current = true;
    setStatus("uploading");
    setError(null);

    try {
      // Step 1: signed URL を取得
      const res = await fetch("/api/account/avatar-upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type }),
      });
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("application/json")) {
        throw new Error(
          res.status === 401
            ? "ログインが必要です"
            : "アップロードを開始できませんでした",
        );
      }
      const data = (await res.json().catch(() => null)) as
        | { ok: true; url: string; path: string }
        | { ok: false; message: string }
        | null;
      if (!res.ok || !data || !("ok" in data) || !data.ok) {
        throw new Error(
          (data && "message" in data && data.message) ||
            "アップロードを開始できませんでした",
        );
      }

      // Step 2: Storage に直接 PUT
      const put = await fetch(data.url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) {
        throw new Error("アップロードに失敗しました");
      }

      // Step 3: DB の avatar_path を更新
      const updateResult = await updateAvatarPathAction(data.path);
      if (!updateResult.ok) {
        throw new Error(updateResult.error);
      }

      // Step 4: プレビュー即時更新。Supabase の public URL は
      // ${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${path}
      const publicUrl = buildAvatarPublicUrl(data.path);
      setPreviewUrl(publicUrl);
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
    }
  }

  return (
    <div className="flex items-start gap-4">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={onFileChange}
        aria-label="アバター画像を選択"
      />

      {/* 現在のアバター or placeholder */}
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-background bg-muted shadow-sm">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="現在のアバター"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-muted-foreground">
            {initial || <User className="h-8 w-8" aria-hidden />}
          </div>
        )}
        {status === "uploading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-foreground/40">
            <Loader2 className="h-6 w-6 animate-spin text-white" aria-hidden />
          </div>
        )}
      </div>

      <div className="flex-1 space-y-2">
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openPicker}
            disabled={status === "uploading"}
          >
            {previewUrl ? (
              <>
                <RefreshCw className="h-4 w-4" />
                アバターを変更
              </>
            ) : (
              <>
                <UploadIcon className="h-4 w-4" />
                アバターを設定
              </>
            )}
          </Button>
          <p className="mt-1.5 text-xs text-muted-foreground">
            PNG / JPEG / WebP、最大 {formatBytes(AVATAR_MAX_BYTES)}
          </p>
        </div>

        {status === "uploaded" && (
          <p className="text-xs font-medium text-emerald-700">
            ✓ アバターを更新しました
          </p>
        )}
        {status === "error" && error && (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive"
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Supabase Storage の public URL を組み立て。
 * env NEXT_PUBLIC_SUPABASE_URL に依存(client 側で使える)。
 */
function buildAvatarPublicUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/avatars/${path}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

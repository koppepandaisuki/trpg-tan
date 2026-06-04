"use client";

import * as React from "react";
import { Check, Loader2, RefreshCw, Upload as UploadIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SCREENSHOT_MAX_BYTES,
  SCREENSHOTS_MAX_COUNT,
} from "@/lib/format/upload";

/**
 * 1 商品につき最大 4 枚のスクリーンショットを管理する UI。
 * UploadCover と同じ「signed URL → PUT」フローを slot 単位で繰り返す。
 *
 * 内部 state:
 *  - slots: 4 個の固定配列。各 slot は { status, file?, error? }
 *  - upload が成功した slot は uploaded 状態(差し替え可能)
 *  - 削除 UI は α 初期では省略(差し替えのみ)。後続で「削除して詰める」
 *    挙動を入れる余地あり
 *
 * 親には「アップロード中フラグ」だけ通知して保存ボタンを抑止する。
 */
const ACCEPT = "image/png,image/jpeg,image/webp";

type SlotStatus = "idle" | "uploading" | "uploaded" | "error";

interface SlotState {
  status: SlotStatus;
  file?: File;
  error?: string;
}

interface UploadScreenshotsProps {
  productId: string;
  /** 初期表示用に既存スクショの「設定済み slot 数」を渡す。表示マークだけ。 */
  initialFilledSlots?: number;
  /** Builder の保存ボタンを抑止するため、進行中フラグを通知 */
  onUploadingChange: (uploading: boolean) => void;
}

export function UploadScreenshots({
  productId,
  initialFilledSlots = 0,
  onUploadingChange,
}: UploadScreenshotsProps) {
  // 初期 state: 既存ぶんは uploaded、それ以外は idle
  const [slots, setSlots] = React.useState<SlotState[]>(() =>
    Array.from({ length: SCREENSHOTS_MAX_COUNT }, (_, i) => ({
      status: i < initialFilledSlots ? "uploaded" : "idle",
    })),
  );
  const inputRefs = React.useRef<Array<HTMLInputElement | null>>([]);
  const inFlight = React.useRef<Set<number>>(new Set());

  function openPicker(index: number) {
    inputRefs.current[index]?.click();
  }

  function updateSlot(index: number, partial: Partial<SlotState>) {
    setSlots((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...partial };
      return next;
    });
  }

  async function uploadSlot(index: number, file: File) {
    // クライアント側 size 検証(バケット側も file_size_limit で防がれるが
    // 早期フィードバック)
    if (file.size > SCREENSHOT_MAX_BYTES) {
      updateSlot(index, {
        status: "error",
        error: `ファイルサイズが上限(${formatBytes(SCREENSHOT_MAX_BYTES)})を超えています`,
      });
      return;
    }

    inFlight.current.add(index);
    onUploadingChange(true);
    updateSlot(index, { status: "uploading", file, error: undefined });

    try {
      // Step 1: signed URL 取得
      const res = await fetch(
        `/api/products/${productId}/screenshot-upload-url`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentType: file.type, orderIndex: index }),
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
        | { ok: false; message: string }
        | null;
      if (!res.ok || !data || !("ok" in data) || !data.ok) {
        throw new Error(
          (data && "message" in data && data.message) ||
            "アップロードを開始できませんでした",
        );
      }

      // Step 2: signed URL に PUT
      const put = await fetch(data.url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) {
        throw new Error("アップロードに失敗しました。再度お試しください");
      }

      updateSlot(index, { status: "uploaded", file });
    } catch (err) {
      updateSlot(index, {
        status: "error",
        error:
          err instanceof Error
            ? err.message
            : "アップロードに失敗しました。再度お試しください",
      });
    } finally {
      inFlight.current.delete(index);
      if (inFlight.current.size === 0) onUploadingChange(false);
    }
  }

  function onFileChange(
    index: number,
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (inFlight.current.has(index)) return;
    void uploadSlot(index, file);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        商品詳細ページに表示される画像です。最大 {SCREENSHOTS_MAX_COUNT} 枚、
        各 {formatBytes(SCREENSHOT_MAX_BYTES)} まで。
      </p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {slots.map((slot, i) => (
          <li key={i}>
            <SlotCard
              index={i}
              slot={slot}
              onClick={() => openPicker(i)}
              inputRef={(el) => {
                inputRefs.current[i] = el;
              }}
              onFileChange={(e) => onFileChange(i, e)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function SlotCard({
  index,
  slot,
  onClick,
  inputRef,
  onFileChange,
}: {
  index: number;
  slot: SlotState;
  onClick: () => void;
  inputRef: (el: HTMLInputElement | null) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-1.5">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={onFileChange}
        aria-label={`スクリーンショット ${index + 1} を選択`}
      />
      <button
        type="button"
        onClick={onClick}
        disabled={slot.status === "uploading"}
        className="group relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-muted/40 transition hover:border-foreground/30"
      >
        {slot.status === "uploading" && (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        )}
        {slot.status === "idle" && (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <UploadIcon className="h-5 w-5" aria-hidden />
            <span className="text-[10px]">スロット {index + 1}</span>
          </div>
        )}
        {slot.status === "uploaded" && (
          <div className="flex flex-col items-center gap-1 text-emerald-700">
            <Check className="h-5 w-5" aria-hidden />
            <span className="text-[10px]">設定済み</span>
            <span className="text-[10px] text-muted-foreground">差替: クリック</span>
          </div>
        )}
        {slot.status === "error" && (
          <div className="flex flex-col items-center gap-1 px-2 text-destructive">
            <X className="h-5 w-5" aria-hidden />
            <span className="line-clamp-2 text-[10px]">{slot.error ?? "失敗"}</span>
          </div>
        )}
      </button>
      {slot.status === "uploaded" && slot.file && (
        <p className="line-clamp-1 text-[10px] text-muted-foreground">
          {slot.file.name} ({formatBytes(slot.file.size)})
        </p>
      )}
      {slot.status === "error" && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClick}
          className="w-full text-xs"
        >
          <RefreshCw className="h-3 w-3" />
          再アップロード
        </Button>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

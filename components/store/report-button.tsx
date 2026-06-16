"use client";

import * as React from "react";
import { Flag, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reportProductAction } from "@/app/(public)/store/[slug]/report-actions";
import {
  REPORT_CATEGORY_LABEL,
  REPORT_CATEGORY_ORDER,
  type ReportCategory,
} from "@/lib/validators/report";

interface ReportButtonProps {
  productId: string;
  /** 未ログインなら、押下時にログインを促す。 */
  loggedIn: boolean;
}

/**
 * 作品の通報ボタン + モーダル。
 *
 * 「ゲームに即さない投稿」「不適切な内容」を利用者が運営へ報告する導線。
 * 送信は reportProductAction(認証必須・重複不可)。送信後は控えめな
 * 完了表示に切り替える。
 */
export function ReportButton({ productId, loggedIn }: ReportButtonProps) {
  const [open, setOpen] = React.useState(false);
  const [category, setCategory] = React.useState<ReportCategory>("inappropriate");
  const [reason, setReason] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await reportProductAction(productId, { category, reason });
      if (result.ok) {
        setDone(true);
        setOpen(false);
      } else {
        setError(result.error);
      }
    });
  }

  if (done) {
    return (
      <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Flag className="h-3.5 w-3.5" aria-hidden />
        通報を受け付けました。ご協力ありがとうございます。
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <Flag className="h-3.5 w-3.5" aria-hidden />
        この作品を通報する
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="作品を通報"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <Flag className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden />
                この作品を通報する
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="閉じる"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!loggedIn ? (
              <p className="mt-4 text-sm text-muted-foreground">
                通報するにはログインが必要です。送信時にログイン画面へ移動します。
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                ストアの趣旨に合わない投稿や不適切な内容を運営に報告します。
                内容は運営のみが確認します。
              </p>
            )}

            <div className="mt-4 space-y-3">
              <div>
                <label
                  htmlFor="report-category"
                  className="mb-1 block text-xs font-medium"
                >
                  種類
                </label>
                <select
                  id="report-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ReportCategory)}
                  className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
                >
                  {REPORT_CATEGORY_ORDER.map((c) => (
                    <option key={c} value={c}>
                      {REPORT_CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="report-reason"
                  className="mb-1 block text-xs font-medium"
                >
                  詳細(必須)
                </label>
                <textarea
                  id="report-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                  maxLength={1000}
                  placeholder="具体的な内容を教えてください。"
                  className="w-full resize-y rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
                />
              </div>

              {error && (
                <p role="alert" className="text-xs text-destructive">
                  {error}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                >
                  キャンセル
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={submit}
                  disabled={pending || reason.trim().length === 0}
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Flag className="h-4 w-4" />
                  )}
                  通報する
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

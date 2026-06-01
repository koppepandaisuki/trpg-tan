"use client";

import { useState } from "react";
import { Loader2, MessageSquarePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { FeedbackCategory } from "@/lib/validators/feedback";
import { cn } from "@/lib/utils";

/**
 * Floating feedback button + modal (Client Component)。
 *
 * 右下に固定の丸ボタン。クリックでモーダル展開、カテゴリ選択 + 本文入力
 * → POST /api/feedback。送信後 1.5 秒で自動 close。
 *
 * UX 方針:
 *   - 邪魔にならない位置 / サイズ(56px、bottom-right)
 *   - 添付ファイル / 画像は MVP では非対応(α は最低限の文章だけ)
 *   - ユーザー情報・URL はサーバー側で自動付与、本人には表示で告知のみ
 */

const CATEGORIES: { value: FeedbackCategory; label: string }[] = [
  { value: "bug", label: "🐛 バグ" },
  { value: "feature_request", label: "✨ 機能要望" },
  { value: "question", label: "❓ 質問" },
  { value: "other", label: "📝 その他" },
];

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function reset() {
    setCategory("bug");
    setBody("");
    setError(null);
    setSuccess(false);
  }

  function close() {
    if (loading) return;
    setOpen(false);
    // 状態リセットは閉じるアニメ後にしたいので少し遅延
    setTimeout(reset, 200);
  }

  async function submit() {
    if (loading) return;
    setError(null);

    const trimmed = body.trim();
    if (trimmed.length < 3) {
      setError("本文は 3 文字以上で入力してください");
      return;
    }

    setLoading(true);
    try {
      const pageUrl =
        typeof window !== "undefined" ? window.location.href : undefined;
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, body: trimmed, pageUrl }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        delivered?: boolean;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? "送信に失敗しました");
      }
      setSuccess(true);
      // 1.5 秒後に閉じる
      setTimeout(() => close(), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "送信に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50",
          "flex h-14 w-14 items-center justify-center",
          "rounded-full bg-primary text-primary-foreground shadow-lg",
          "transition hover:bg-primary/90 hover:scale-105",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        )}
        aria-label="フィードバックを送る"
      >
        <MessageSquarePlus className="h-6 w-6" aria-hidden />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 id="feedback-title" className="text-lg font-semibold">
                フィードバック
              </h2>
              <button
                type="button"
                onClick={close}
                disabled={loading}
                className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
                aria-label="閉じる"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-2 text-sm text-muted-foreground">
              バグ報告・機能要望・質問など、お気軽にどうぞ
            </p>

            <fieldset disabled={loading} className="mt-4 space-y-2">
              <legend className="text-sm font-medium">種類</legend>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategory(c.value)}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-sm transition",
                      category === c.value
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-card text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="mt-4 space-y-1">
              <label
                htmlFor="feedback-body"
                className="text-sm font-medium"
              >
                内容
              </label>
              <Textarea
                id="feedback-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="何があった / どうなって欲しい / 質問内容など。詳しく書くほど助かります(3〜1000 文字)"
                rows={5}
                disabled={loading}
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground">
                送信時に <strong>あなたのユーザー ID / メールアドレス / 現在の URL</strong> が自動で添付されます
              </p>
            </div>

            {error && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {error}
              </p>
            )}
            {success && (
              <p role="alert" className="mt-3 text-sm text-emerald-700">
                送信しました。ありがとうございました
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={close}
                disabled={loading}
              >
                キャンセル
              </Button>
              <Button
                type="button"
                onClick={submit}
                disabled={loading || body.trim().length < 3}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : null}
                送信
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

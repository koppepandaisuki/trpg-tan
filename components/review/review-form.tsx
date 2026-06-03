"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  submitReviewAction,
  deleteReviewAction,
} from "@/app/(public)/store/[slug]/review-actions";
import type { ReviewRating } from "@/lib/validators/review";
import { cn } from "@/lib/utils";

/**
 * 自分のレビューを投稿 / 編集 / 削除するフォーム(購入済みユーザーのみ
 * 商品詳細ページで表示)。
 *
 * 状態:
 *  - rating: positive / negative / null(未選択)
 *  - comment: 任意のテキスト
 *  - 初期値があれば編集モード(既存値を埋める)
 *  - 削除ボタン(既存レビューがあるときだけ表示)
 *
 * 「投稿」ボタンは rating が選ばれているときだけ active。
 * 成功時は Server Action 側の revalidatePath で SSR が再描画され、
 * 投稿後の集計に反映される。
 */
interface ReviewFormProps {
  productId: string;
  productSlug: string;
  initialRating?: ReviewRating | null;
  initialComment?: string;
}

export function ReviewForm({
  productId,
  productSlug,
  initialRating = null,
  initialComment = "",
}: ReviewFormProps) {
  const [rating, setRating] = useState<ReviewRating | null>(initialRating);
  const [comment, setComment] = useState(initialComment);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = initialRating !== null;

  async function onSubmit() {
    if (!rating) {
      setError("高評価か低評価を選んでください");
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await submitReviewAction(productId, productSlug, {
      rating,
      comment,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
    }
  }

  async function onDelete() {
    if (!confirm("レビューを削除します。よろしいですか?")) return;
    setDeleting(true);
    setError(null);
    const result = await deleteReviewAction(productId, productSlug);
    setDeleting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setRating(null);
    setComment("");
  }

  return (
    <div className="space-y-3 rounded-md border border-border bg-card p-4 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {isEditing ? "あなたのレビューを編集" : "この作品をレビューする"}
      </p>

      {/* Rating buttons */}
      <div className="flex gap-2">
        <RatingButton
          icon={ThumbsUp}
          label="高評価"
          tone="positive"
          active={rating === "positive"}
          onClick={() => setRating("positive")}
        />
        <RatingButton
          icon={ThumbsDown}
          label="低評価"
          tone="negative"
          active={rating === "negative"}
          onClick={() => setRating("negative")}
        />
      </div>

      {/* Comment */}
      <Textarea
        rows={3}
        maxLength={2000}
        placeholder="コメント(任意、最大 2000 文字)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        aria-label="レビューコメント"
      />

      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={onSubmit}
          disabled={submitting || !rating}
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEditing ? "更新する" : "投稿する"}
        </Button>
        {isEditing && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDelete}
            disabled={deleting}
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            削除
          </Button>
        )}
        <p className="text-[11px] text-muted-foreground">
          投稿後は他のユーザーから見える状態になります。
        </p>
      </div>
    </div>
  );
}

function RatingButton({
  icon: Icon,
  label,
  tone,
  active,
  onClick,
}: {
  icon: typeof ThumbsUp;
  label: string;
  tone: "positive" | "negative";
  active: boolean;
  onClick: () => void;
}) {
  const activeStyle =
    tone === "positive"
      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
      : "border-rose-300 bg-rose-50 text-rose-800";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition",
        active
          ? activeStyle
          : "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {label}
    </button>
  );
}

"use client";

import { useState, useEffect } from "react";
import { Loader2, Trash2, Gamepad2, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  submitReviewAction,
  deleteReviewAction,
} from "@/app/(public)/store/[slug]/review-actions";
import { StarRating } from "@/components/review/star-rating";

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
  initialStars?: number | null;
  initialComment?: string;
}

export function ReviewForm({
  productId,
  productSlug,
  initialStars = null,
  initialComment = "",
}: ReviewFormProps) {
  const [stars, setStars] = useState<number>(initialStars ?? 0);
  const [comment, setComment] = useState(initialComment);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = initialStars !== null;

  // プレイ後レビュー導線(VVVVV)。購入済みでも、まず「プレイしましたか?」
  // のワンクッションを挟む。レビューは購入直後ではなく「遊んだ後の感想」を
  // 想定しているため。既にレビュー済み(= プレイ済み)なら最初から展開。
  const [expanded, setExpanded] = useState(isEditing);

  // 一度「プレイした」を確認した作品は localStorage に記録し、再訪時に
  // ゲートを出さない(SSR 由来のハイドレーション差異を避けるため effect 内で読む)。
  const storageKey = `played:${productId}`;
  useEffect(() => {
    if (isEditing) return;
    try {
      if (window.localStorage.getItem(storageKey) === "1") setExpanded(true);
    } catch {
      // localStorage 不可環境(プライベートモード等)は黙って無視
    }
  }, [isEditing, storageKey]);

  function confirmPlayed() {
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // 記録できなくてもゲートは開く
    }
    setExpanded(true);
  }

  // ゲート未通過(未プレイ確認 + 未投稿)のときはプレイ確認カードを表示
  if (!expanded) {
    return <PlayedGate onConfirm={confirmPlayed} />;
  }

  async function onSubmit() {
    if (stars < 1) {
      setError("星をタップして評価を選んでください");
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await submitReviewAction(productId, productSlug, {
      stars,
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
    setStars(0);
    setComment("");
  }

  return (
    <div className="space-y-3 rounded-md border border-border bg-card p-4 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {isEditing ? "あなたのレビューを編集" : "プレイした感想をレビューする"}
      </p>

      {/* 5 段階の星評価 */}
      <div className="flex items-center gap-3">
        <StarRating value={stars} onChange={setStars} size="lg" />
        <span className="text-sm text-muted-foreground">
          {stars > 0 ? STAR_WORD[stars] : "星をタップ"}
        </span>
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
          disabled={submitting || stars < 1}
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

/**
 * プレイ後レビューのゲート(VVVVV)。購入済みユーザーに、いきなり評価
 * ボタンを出すのではなく「この作品をプレイしましたか?」のワンクッション
 * を挟む。レビューが「購入直後の印象」ではなく「実際に遊んだ後の感想」に
 * なるよう促す。ボタンを押すと本来のフォームが展開する。
 */
function PlayedGate({ onConfirm }: { onConfirm: () => void }) {
  return (
    <div className="space-y-3 rounded-md border border-sky-200 bg-sky-50/40 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-sky-700">
          <Gamepad2 className="h-4 w-4" aria-hidden />
        </div>
        <div className="space-y-0.5">
          <p className="text-sm font-semibold tracking-tight">
            この作品をプレイしましたか?
          </p>
          <p className="text-xs text-muted-foreground">
            レビューはプレイ後の感想を想定しています。実際に遊んでから、ほかのユーザーの参考になる感想を残しましょう。
          </p>
        </div>
      </div>
      <Button type="button" variant="primary" size="sm" onClick={onConfirm}>
        <PenLine className="h-4 w-4" />
        プレイ後のレビューを書く
      </Button>
    </div>
  );
}

/** 星の数に対応する短い言葉(選択中の今の評価を言語化)。 */
const STAR_WORD: Record<number, string> = {
  1: "いまひとつ",
  2: "もう少し",
  3: "ふつう",
  4: "良かった",
  5: "最高！",
};

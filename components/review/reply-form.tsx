"use client";

import { useState } from "react";
import { Loader2, MessageSquare, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  submitReplyAction,
  deleteReplyAction,
} from "@/app/(public)/store/[slug]/review-actions";

/**
 * creator が「自分の商品のレビュー」に返信するフォーム(NNNN)。
 *
 * 状態:
 *  - 既存 reply がある(editing): 入力欄に initial body、保存 + 削除ボタン
 *  - 既存 reply がない(new): 空入力欄、投稿ボタンのみ
 *
 * Server Action 経由で upsert / delete。成功時に revalidatePath で SSR
 * 再描画される。
 */
interface ReplyFormProps {
  reviewId: string;
  productSlug: string;
  initialBody?: string;
  hasExistingReply: boolean;
}

export function ReplyForm({
  reviewId,
  productSlug,
  initialBody = "",
  hasExistingReply,
}: ReplyFormProps) {
  const [body, setBody] = useState(initialBody);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (!body.trim()) {
      setError("返信内容を入力してください");
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await submitReplyAction(reviewId, productSlug, { body });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
    }
  }

  async function onDelete() {
    if (!confirm("返信を削除します。よろしいですか?")) return;
    setDeleting(true);
    setError(null);
    const result = await deleteReplyAction(reviewId, productSlug);
    setDeleting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBody("");
  }

  return (
    <div className="space-y-2 rounded-md border border-indigo-200 bg-indigo-50/40 px-3 py-2">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-700">
        <MessageSquare className="h-3 w-3" aria-hidden />
        {hasExistingReply ? "あなたの返信を編集" : "このレビューに返信"}
      </p>
      <Textarea
        rows={2}
        maxLength={2000}
        placeholder="購入ありがとうございます…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        aria-label="creator からの返信"
      />
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive"
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
          disabled={submitting || !body.trim()}
        >
          {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {hasExistingReply ? "更新する" : "返信する"}
        </Button>
        {hasExistingReply && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDelete}
            disabled={deleting}
          >
            {deleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            削除
          </Button>
        )}
      </div>
    </div>
  );
}

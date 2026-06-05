"use client";

import { useState, useTransition } from "react";
import { ThumbsUp } from "lucide-react";
import { toggleHelpfulVoteAction } from "@/app/(public)/store/[slug]/review-actions";
import { cn } from "@/lib/utils";

/**
 * レビューの「役に立った」投票ボタン(LLLLL)。Amazon / Steam の
 * "Was this review helpful?" 相当。
 *
 * - ログイン時のみ投票可能(未ログインは disabled + ヒント)
 * - クリックで toggle、楽観的に count を増減
 * - server action の revalidatePath で最終的に整合する
 *
 * 楽観更新: server 応答を待たずに count / voted を即変える。失敗したら
 * 元に戻す(UX のレスポンスを優先)。
 */
interface HelpfulButtonProps {
  reviewId: string;
  productSlug: string;
  initialCount: number;
  initialVoted: boolean;
  canVote: boolean;
}

export function HelpfulButton({
  reviewId,
  productSlug,
  initialCount,
  initialVoted,
  canVote,
}: HelpfulButtonProps) {
  const [count, setCount] = useState(initialCount);
  const [voted, setVoted] = useState(initialVoted);
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!canVote || pending) return;

    // 楽観更新
    const prevVoted = voted;
    const prevCount = count;
    const nextVoted = !voted;
    setVoted(nextVoted);
    setCount((c) => c + (nextVoted ? 1 : -1));

    startTransition(async () => {
      const result = await toggleHelpfulVoteAction(reviewId, productSlug);
      if (!result.ok) {
        // ロールバック
        setVoted(prevVoted);
        setCount(prevCount);
      } else {
        // server の確定値に合わせる(楽観値とズレることは稀だが安全側)
        setVoted(result.voted);
      }
    });
  }

  if (!canVote) {
    // 未ログイン: 表示のみ(押せない)
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <ThumbsUp className="h-3 w-3" aria-hidden />
        {count > 0 ? `${count} 人が役に立ったと評価` : "役に立った"}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={voted}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition active:scale-95",
        voted
          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
          : "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground",
      )}
    >
      <ThumbsUp
        className={cn("h-3 w-3", voted && "fill-current")}
        aria-hidden
      />
      役に立った
      {count > 0 && <span>({count})</span>}
    </button>
  );
}

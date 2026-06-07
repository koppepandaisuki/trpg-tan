"use client";

import { useState } from "react";
import { UserCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setFollowAction } from "@/app/(public)/creator/[id]/follow-actions";

/**
 * クリエイターの「フォロー」ボタン + フォロワー数。DB 永続(SNS 的フォロー)。
 * 楽観更新で即座に反映し、失敗したらロールバック。未ログインはログインへ誘導。
 * 自分自身のプロフィールではフォロワー数のみ表示する。
 */
export function FollowCreatorButton({
  creatorId,
  initialFollowing,
  initialCount,
  isSelf,
  isAuthed,
}: {
  creatorId: string;
  initialFollowing: boolean;
  initialCount: number;
  isSelf: boolean;
  isAuthed: boolean;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  if (isSelf) {
    return (
      <span className="text-xs text-muted-foreground">
        フォロワー {count} 人
      </span>
    );
  }

  async function toggle() {
    if (!isAuthed) {
      window.location.href = `/login?next=/creator/${creatorId}`;
      return;
    }
    const next = !following;
    setFollowing(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    setBusy(true);
    try {
      const result = await setFollowAction(creatorId, next);
      if (!result.ok) {
        setFollowing(!next);
        setCount((c) => Math.max(0, c + (next ? -1 : 1)));
      }
    } catch {
      setFollowing(!next);
      setCount((c) => Math.max(0, c + (next ? -1 : 1)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={toggle}
        disabled={busy}
        size="sm"
        variant={following ? "secondary" : "primary"}
      >
        {following ? (
          <>
            <UserCheck className="mr-1.5 h-4 w-4" /> フォロー中
          </>
        ) : (
          <>
            <UserPlus className="mr-1.5 h-4 w-4" /> フォロー
          </>
        )}
      </Button>
      <span className="text-xs text-muted-foreground">
        フォロワー {count} 人
      </span>
    </div>
  );
}

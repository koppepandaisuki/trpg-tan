import { User, UserMinus } from "lucide-react";
import { publicAvatarUrl } from "@/lib/format/storage";
import { removeFriendAction } from "@/app/(app)/friends/actions";
import type { FriendListItem } from "@/lib/queries/friends";
import { cn } from "@/lib/utils";

function lastSeenLabel(item: FriendListItem): string {
  if (item.online) return "オンライン";
  if (!item.lastSeenAt) return "オフライン";
  const min = Math.floor((Date.now() - new Date(item.lastSeenAt).getTime()) / 60000);
  if (min < 60) return `${Math.max(min, 1)}分前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}時間前`;
  const day = Math.floor(hr / 24);
  return day < 30 ? `${day}日前` : "30日以上前";
}

/** フレンド一覧(在席ドット + 最終ログイン + 解除)。 */
export function FriendList({ friends }: { friends: FriendListItem[] }) {
  if (friends.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        まだフレンドがいません。上の招待リンクを送ってみましょう。
      </p>
    );
  }

  const onlineCount = friends.filter((f) => f.online).length;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {friends.length} 人 ・ オンライン {onlineCount} 人
      </p>
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
        {friends.map((f) => {
          const avatar = publicAvatarUrl(f.avatarPath);
          return (
            <li key={f.id} className="flex items-center gap-3 p-3">
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-muted">
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatar}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <User className="h-5 w-5" aria-hidden />
                  </div>
                )}
                <span
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card",
                    f.online ? "bg-emerald-500" : "bg-muted-foreground/40",
                  )}
                  aria-hidden
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {f.displayName || "(名称未設定)"}
                </p>
                <p
                  className={cn(
                    "text-xs",
                    f.online ? "text-emerald-600" : "text-muted-foreground",
                  )}
                >
                  {lastSeenLabel(f)}
                </p>
              </div>

              <form action={removeFriendAction}>
                <input type="hidden" name="friendId" value={f.id} />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-destructive"
                  aria-label={`${f.displayName} を解除`}
                >
                  <UserMinus className="h-3.5 w-3.5" /> 解除
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

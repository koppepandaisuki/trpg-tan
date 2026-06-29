"use client";

import * as React from "react";
import { UserPlus, Users, Sparkles, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 主催(adminToken 持ち)が日程調整にフレンドを招待するパネル。
 *  - 「フレンドを呼び出す」で /api/friends/list-min から自分のフレンドを取得
 *  - チェックでフレンドを選び、「選んだフレンドを招待」で POST /api/schedule/invite
 *  - 同時に「空き時間レコメンド」を表示: 候補日 X について「○ A 人 / × B 人」
 *
 * 未ログイン or フレンドゼロのときは何も描かない(主催が DM で URL を配る世界の
 * 互換は維持される)。
 */

type FriendItem = {
  id: string;
  displayName: string;
  avatarPath: string | null;
  online: boolean;
};

type AvailRow = {
  dateIso: string;
  yes: number;
  no: number;
  maybe: number;
};

export function FriendInvitePanel({
  adminToken,
  publicToken,
  slots,
}: {
  adminToken: string;
  publicToken: string;
  slots: { id: string; startsAt: string }[];
}) {
  const [friends, setFriends] = React.useState<FriendItem[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [alreadySent, setAlreadySent] = React.useState<Set<string>>(new Set());
  const [avail, setAvail] = React.useState<AvailRow[] | null>(null);

  // 候補スロットを「日付(JST)」に丸める。複数スロットが同じ日なら重複排除。
  const candidateDates = React.useMemo(() => {
    const set = new Set<string>();
    for (const s of slots) {
      const d = new Date(s.startsAt);
      // JST に揃えてから yyyy-mm-dd 化。
      const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
      set.add(jst.toISOString().slice(0, 10));
    }
    return [...set].sort();
  }, [slots]);

  async function loadFriends() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/friends/list-min", { cache: "no-store" });
      const data = (await res.json()) as
        | { ok: true; friends: FriendItem[] }
        | { ok: false; message?: string };
      if (!res.ok || !("ok" in data) || !data.ok) {
        setMsg(
          ("message" in data && data.message) || "フレンドを取得できません",
        );
        setFriends([]);
        return;
      }
      setFriends(data.friends);
    } catch {
      setMsg("フレンドを取得できません");
      setFriends([]);
    } finally {
      setLoading(false);
    }
  }

  // フレンド選択が変わるたびに空き集計を再取得(候補日 × 選択フレンド)。
  React.useEffect(() => {
    let alive = true;
    if (selected.size === 0 || candidateDates.length === 0) {
      setAvail(null);
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/schedule/friend-availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            friendIds: [...selected],
            dates: candidateDates,
          }),
        });
        const data = (await res.json()) as
          | { ok: true; rows: AvailRow[] }
          | { ok: false; message?: string };
        if (!alive) return;
        if (res.ok && "ok" in data && data.ok) setAvail(data.rows);
        else setAvail(null);
      } catch {
        if (alive) setAvail(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [selected, candidateDates]);

  async function sendInvites() {
    if (selected.size === 0) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/schedule/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminToken, friendIds: [...selected] }),
      });
      const data = (await res.json()) as
        | { ok: true; accepted: string[]; rejected: string[] }
        | { ok: false; message?: string };
      if (!res.ok || !("ok" in data) || !data.ok) {
        setMsg(
          ("message" in data && data.message) || "送信に失敗しました",
        );
        return;
      }
      setAlreadySent((s) => new Set([...s, ...data.accepted]));
      setSelected(new Set());
      setMsg(
        data.rejected.length === 0
          ? `${data.accepted.length} 人に招待を送信しました`
          : `${data.accepted.length} 人に送信(${data.rejected.length} 人は失敗)`,
      );
    } catch {
      setMsg("送信に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  // 「招待」だけでなく、URL コピー導線も維持する(既存の ShareBox とは別の場所で出さない)。
  // 公開トークンは存在確認のために受け取るだけ(URL は ShareBox 側が組み立てる)。
  void publicToken;

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-sm font-semibold">
          <UserPlus className="h-4 w-4" />
          フレンドを招待
        </p>
        {friends === null && (
          <button
            type="button"
            onClick={loadFriends}
            disabled={loading}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs hover:bg-muted"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Users className="h-3.5 w-3.5" />
            )}
            フレンドを呼び出す
          </button>
        )}
      </div>

      {friends && friends.length === 0 && (
        <p className="text-xs text-muted-foreground">
          フレンドがいません。アプリのフレンドパネルからコードで追加できます。
        </p>
      )}

      {friends && friends.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {friends.map((f) => {
              const already = alreadySent.has(f.id);
              const on = selected.has(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => !already && toggle(f.id)}
                  disabled={already}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs",
                    on
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-muted/50",
                    already && "opacity-50 cursor-default",
                  )}
                >
                  <span className="relative">
                    {f.avatarPath ? (
                      <FriendAvatar path={f.avatarPath} />
                    ) : (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                      </span>
                    )}
                    {f.online && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500" />
                    )}
                  </span>
                  <span className="flex-1 truncate">
                    {f.displayName || "(無名)"}
                  </span>
                  {already ? (
                    <span className="text-emerald-600">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  ) : on ? (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void sendInvites()}
              disabled={busy || selected.size === 0}
              className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {selected.size === 0
                ? "招待するフレンドを選択"
                : `${selected.size} 人に招待を送る`}
            </button>
            {msg && (
              <span className="text-xs text-muted-foreground">{msg}</span>
            )}
          </div>

          {avail && avail.length > 0 && (
            <div className="rounded-md border border-border bg-muted/30 p-2">
              <p className="mb-1 inline-flex items-center gap-1 text-xs font-semibold">
                <Sparkles className="h-3.5 w-3.5" />
                選んだフレンドの空き時間レコメンド
              </p>
              <p className="mb-2 text-[11px] text-muted-foreground">
                各候補日に対して、選んだフレンドが他の調整で入れている
                ○/△/× の集計です(参考)。
              </p>
              <div className="flex flex-wrap gap-1.5">
                {avail.map((r) => (
                  <span
                    key={r.dateIso}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px]",
                      r.yes > r.no && r.yes > 0
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
                        : r.no > 0 && r.no >= r.yes
                          ? "border-rose-500/40 bg-rose-500/10 text-rose-700"
                          : "border-border text-muted-foreground",
                    )}
                  >
                    <code>{r.dateIso}</code>
                    <span>○{r.yes}</span>
                    <span>△{r.maybe}</span>
                    <span>×{r.no}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FriendAvatar({ path }: { path: string }) {
  // public URL を組み立て(server で生成済みなら不要だが、ここは client なので
  // 環境変数からも組み立てられるよう env を読む。Supabase の avatar bucket は public)。
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const url = base ? `${base}/storage/v1/object/public/avatars/${path}` : "";
  return (
    <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-muted">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <Users className="h-3.5 w-3.5" />
      )}
    </span>
  );
}

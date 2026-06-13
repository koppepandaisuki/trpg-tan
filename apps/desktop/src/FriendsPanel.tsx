import { useEffect, useState } from "react";
import { Users, ExternalLink } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { supabase, supabaseConfigured } from "./supabase";
import { useAuth } from "./useAuth";

/**
 * フレンド(下部バー右端。Steam の「フレンド&チャット」枠)。
 *  - Web と同じ friendships / list_friends RPC を読む(ログイン必須)
 *  - アプリ起動中は touch_presence を心拍してオンライン状態を発信
 *  - 招待リンクの発行・承認は Web(/friends)に集約
 */

const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const HEARTBEAT_MS = 2 * 60 * 1000;
const REFRESH_MS = 60 * 1000;

interface FriendItem {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  lastSeenAt: string | null;
  online: boolean;
}

async function fetchFriends(): Promise<FriendItem[]> {
  const { data, error } = await supabase.rpc("list_friends");
  if (error) throw new Error(error.message);
  const now = Date.now();
  return ((data ?? []) as {
    id: string;
    display_name: string | null;
    avatar_path: string | null;
    last_seen_at: string | null;
  }[]).map((r) => ({
    id: r.id,
    displayName: r.display_name ?? "",
    avatarUrl: r.avatar_path
      ? supabase.storage.from("avatars").getPublicUrl(r.avatar_path).data
          .publicUrl
      : null,
    lastSeenAt: r.last_seen_at,
    online: r.last_seen_at
      ? now - new Date(r.last_seen_at).getTime() < ONLINE_WINDOW_MS
      : false,
  }));
}

function lastSeenLabel(iso: string | null): string {
  if (!iso) return "オフライン";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)} 分前`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)} 時間前`;
  return `${Math.floor(mins / (60 * 24))} 日前`;
}

export function FriendsButton() {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [friends, setFriends] = useState<FriendItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loggedIn = !!session;

  // 在席の心拍(ログイン中、アプリ起動中ずっと)。
  useEffect(() => {
    if (!loggedIn || !supabaseConfigured) return;
    const beat = () => void supabase.rpc("touch_presence");
    beat();
    const t = window.setInterval(beat, HEARTBEAT_MS);
    return () => window.clearInterval(t);
  }, [loggedIn]);

  // パネルを開いている間は定期更新。
  useEffect(() => {
    if (!open || !loggedIn) return;
    let alive = true;
    const load = () =>
      fetchFriends()
        .then((f) => alive && (setFriends(f), setError(null)))
        .catch((e) => alive && setError(String(e)));
    load();
    const t = window.setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [open, loggedIn]);

  if (!supabaseConfigured) return null;

  const onlineCount = friends?.filter((f) => f.online).length ?? 0;

  return (
    <>
      <button
        className="bottombar-btn ibtn"
        onClick={() => setOpen((v) => !v)}
        title="フレンド"
        aria-expanded={open}
      >
        <Users size={14} /> フレンド
        {friends && friends.length > 0 && (
          <span className={`friends-count ${onlineCount > 0 ? "on" : ""}`}>
            {onlineCount}/{friends.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="friends-backdrop" onClick={() => setOpen(false)} />
          <div className="friends-pop">
            <div className="friends-head ibtn">
              <Users size={15} /> フレンド
            </div>

            {!loggedIn ? (
              <p className="muted friends-note">
                ログインするとフレンドのオンライン状態が見られます。
              </p>
            ) : error ? (
              <p className="tag fail friends-note">{error}</p>
            ) : friends === null ? (
              <p className="muted friends-note">読み込み中…</p>
            ) : friends.length === 0 ? (
              <p className="muted friends-note">
                まだフレンドがいません。Web の招待リンクから追加できます。
              </p>
            ) : (
              <div className="friends-list">
                {[...friends]
                  .sort((a, b) => Number(b.online) - Number(a.online))
                  .map((f) => (
                    <div key={f.id} className="friend-row">
                      <span className="friend-avatar">
                        {f.avatarUrl ? (
                          <img src={f.avatarUrl} alt="" />
                        ) : (
                          <Users size={14} />
                        )}
                        <i className={`friend-dot ${f.online ? "on" : ""}`} />
                      </span>
                      <span className="friend-meta">
                        <b>{f.displayName || "（無名）"}</b>
                        <span className={f.online ? "friend-on" : "muted"}>
                          {f.online ? "オンライン" : lastSeenLabel(f.lastSeenAt)}
                        </span>
                      </span>
                    </div>
                  ))}
              </div>
            )}

            <button
              className="btn mini ibtn"
              style={{ width: "100%" }}
              onClick={() =>
                void openUrl(
                  `${import.meta.env.VITE_WEB_BASE_URL ?? "http://localhost:3000"}/friends`,
                )
              }
              title="招待リンクの発行・承認は Web で行います"
            >
              <ExternalLink size={13} /> 招待・管理（Web）
            </button>
          </div>
        </>
      )}
    </>
  );
}

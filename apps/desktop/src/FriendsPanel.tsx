import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users,
  Copy,
  RefreshCw,
  UserPlus,
  Inbox,
  Check,
  X as XIcon,
  Trash2,
  CalendarClock,
  Hash,
  Heart,
  Star,
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { supabase, supabaseConfigured } from "./supabase";
import { useAuth } from "./useAuth";
import { toast } from "./Toasts";
import {
  ensureMyFriendCode,
  findUserByFriendCode,
  sendFriendRequest,
  respondFriendRequest,
  listMyNotifications,
  myUnreadCount,
  markNotificationsRead,
  deleteNotification,
  type FriendUserPreview,
  type NotificationRow,
} from "./friends-remote";

/**
 * フレンド & 通知の統合ポップオーバー(下部バー右端から開く)。
 *
 * 旧版は表示のみで招待/承認は web に飛ばしていたが、本実装で:
 *   1. 自分のフレンドコード(8 桁英数)を表示・コピー・再生成
 *   2. 相手のコードを入力 → プレビュー → 申請送信
 *   3. インボックス(friend_request / friend_accepted / table_invite /
 *      schedule_invite)を表示し、承認/辞退/削除を行う
 *   4. フレンド一覧(オンライン状態付き)
 *
 * 卓招待を受けたときは onTableInvite で親に通知(参加コード自動入力など)。
 * 日程調整招待を受けたときは onScheduleInvite(あれば)、無ければブラウザで開く。
 */

const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const HEARTBEAT_MS = 2 * 60 * 1000;
const REFRESH_MS = 60 * 1000;
const NOTIF_POLL_MS = 30 * 1000; // 通知バッジ + インボックス更新の間隔

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

export function FriendsButton({
  onTableInvite,
}: {
  /** 卓招待を受信したら呼ばれる。code を使って参加コード入力欄に流す。 */
  onTableInvite?: (code: string, tableName: string) => void;
} = {}) {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"friends" | "inbox" | "add">("friends");
  const [friends, setFriends] = useState<FriendItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unread, setUnread] = useState<number>(0);

  const loggedIn = !!session;

  // 在席の心拍。
  useEffect(() => {
    if (!loggedIn || !supabaseConfigured) return;
    const beat = () => void supabase.rpc("touch_presence");
    beat();
    const t = window.setInterval(beat, HEARTBEAT_MS);
    return () => window.clearInterval(t);
  }, [loggedIn]);

  // 未読バッジ。
  useEffect(() => {
    if (!loggedIn || !supabaseConfigured) return;
    let alive = true;
    const load = () =>
      myUnreadCount()
        .then((n) => alive && setUnread(n))
        .catch(() => {});
    load();
    const t = window.setInterval(load, NOTIF_POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [loggedIn]);

  // パネル開いているあいだのフレンド一覧定期更新。
  useEffect(() => {
    if (!open || !loggedIn || tab !== "friends") return;
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
  }, [open, loggedIn, tab]);

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
        {unread > 0 && (
          <span className="friends-count on" title={`未読 ${unread} 件`}>
            {unread}
          </span>
        )}
        {!unread && friends && friends.length > 0 && (
          <span className={`friends-count ${onlineCount > 0 ? "on" : ""}`}>
            {onlineCount}/{friends.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="friends-backdrop" onClick={() => setOpen(false)} />
          <div className="friends-pop friends-pop-wide">
            <div className="friends-head ibtn">
              <Users size={15} /> フレンド
            </div>

            {!loggedIn ? (
              <p className="muted friends-note">
                ログインするとフレンド機能が使えます。設定 → アカウントから
                Google でログインしてください。
              </p>
            ) : (
              <>
                <div className="friends-tabs">
                  <button
                    className={`friends-tab ${tab === "friends" ? "on" : ""}`}
                    onClick={() => setTab("friends")}
                  >
                    <Users size={13} /> フレンド
                  </button>
                  <button
                    className={`friends-tab ${tab === "inbox" ? "on" : ""}`}
                    onClick={() => setTab("inbox")}
                  >
                    <Inbox size={13} /> 通知
                    {unread > 0 && (
                      <span className="friends-tab-badge">{unread}</span>
                    )}
                  </button>
                  <button
                    className={`friends-tab ${tab === "add" ? "on" : ""}`}
                    onClick={() => setTab("add")}
                  >
                    <UserPlus size={13} /> 追加
                  </button>
                </div>

                {tab === "friends" && (
                  <FriendsList
                    friends={friends}
                    error={error}
                  />
                )}
                {tab === "inbox" && (
                  <InboxTab
                    onTableInvite={(code, tableName) => {
                      setOpen(false);
                      onTableInvite?.(code, tableName);
                    }}
                    onUnreadChange={setUnread}
                  />
                )}
                {tab === "add" && <AddTab />}
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}

function FriendsList({
  friends,
  error,
}: {
  friends: FriendItem[] | null;
  error: string | null;
}) {
  if (error) return <p className="tag fail friends-note">{error}</p>;
  if (friends === null) return <p className="muted friends-note">読み込み中…</p>;
  if (friends.length === 0) {
    return (
      <p className="muted friends-note">
        まだフレンドがいません。「追加」タブからフレンドコードで追加できます。
      </p>
    );
  }
  return (
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
  );
}

/* ===== 追加タブ ===== */

function AddTab() {
  const [myCode, setMyCode] = useState<string | null>(null);
  const [loadingCode, setLoadingCode] = useState(false);
  const [input, setInput] = useState("");
  const [preview, setPreview] = useState<FriendUserPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setLoadingCode(true);
    ensureMyFriendCode()
      .then(setMyCode)
      .catch((e) => setMsg(String(e)))
      .finally(() => setLoadingCode(false));
  }, []);

  async function copyCode() {
    if (!myCode) return;
    try {
      await navigator.clipboard.writeText(myCode);
      toast(`📋 コードをコピーしました: ${myCode}`);
    } catch {
      toast("コピーできませんでした");
    }
  }

  async function preview_() {
    const code = input.trim().toUpperCase();
    if (code.length < 6) {
      setPreview(null);
      setMsg("8 桁のコードを入力してください");
      return;
    }
    setMsg(null);
    setBusy(true);
    try {
      const u = await findUserByFriendCode(code);
      if (!u) {
        setPreview(null);
        setMsg("そのコードのユーザーは見つかりません");
      } else {
        setPreview(u);
      }
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!preview) return;
    setBusy(true);
    setMsg(null);
    try {
      const id = await sendFriendRequest(preview.id);
      if (id === null) {
        setMsg("既にフレンドか、申請を送信済みです");
      } else {
        toast(`📩 ${preview.displayName || "ユーザー"} に申請を送信しました`);
        setPreview(null);
        setInput("");
      }
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="friends-card">
        <p className="friends-card-title">
          <Hash size={13} /> あなたのフレンドコード
        </p>
        <div className="friends-code-row">
          <code className="friends-code">
            {loadingCode ? "…" : myCode ?? "未取得"}
          </code>
          <button
            className="btn mini"
            onClick={() => void copyCode()}
            disabled={!myCode}
            title="クリップボードにコピー"
          >
            <Copy size={13} /> コピー
          </button>
          <button
            className="btn mini"
            onClick={() => {
              setLoadingCode(true);
              ensureMyFriendCode()
                .then(setMyCode)
                .catch((e) => setMsg(String(e)))
                .finally(() => setLoadingCode(false));
            }}
            title="再取得(コードは変わりません)"
          >
            <RefreshCw size={13} />
          </button>
        </div>
        <p className="muted" style={{ fontSize: 11 }}>
          このコードを相手に伝えると、相手から申請を送れます。
        </p>
      </div>

      <div className="friends-card">
        <p className="friends-card-title">
          <UserPlus size={13} /> 相手のコードを入力
        </p>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            className="input"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setPreview(null);
              setMsg(null);
            }}
            placeholder="A1B2C3D4"
            maxLength={8}
            style={{ fontFamily: "monospace", letterSpacing: 1 }}
          />
          <button
            className="btn"
            onClick={() => void preview_()}
            disabled={busy || input.trim().length < 6}
          >
            検索
          </button>
        </div>
        {preview && (
          <div className="friend-row" style={{ marginTop: 6 }}>
            <span className="friend-avatar">
              {preview.avatarUrl ? (
                <img src={preview.avatarUrl} alt="" />
              ) : (
                <Users size={14} />
              )}
            </span>
            <span className="friend-meta" style={{ flex: 1 }}>
              <b>{preview.displayName || "（無名）"}</b>
            </span>
            <button
              className="btn mini btn-primary"
              onClick={() => void send()}
              disabled={busy}
            >
              申請を送る
            </button>
          </div>
        )}
        {msg && (
          <p className="muted" style={{ fontSize: 11, color: "#e5484d" }}>
            {msg}
          </p>
        )}
      </div>
    </div>
  );
}

/* ===== インボックス ===== */

function InboxTab({
  onTableInvite,
  onUnreadChange,
}: {
  onTableInvite: (code: string, tableName: string) => void;
  onUnreadChange: (n: number) => void;
}) {
  const [items, setItems] = useState<NotificationRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const rows = await listMyNotifications(40);
      setItems(rows);
      // 開いたら未読を既読化(承認待ちは respondedAt で別管理)。
      const unreadIds = rows
        .filter((r) => !r.readAt)
        .map((r) => r.id);
      if (unreadIds.length > 0) {
        await markNotificationsRead(unreadIds);
      }
      const remaining = await myUnreadCount();
      onUnreadChange(remaining);
    } catch (e) {
      console.error(e);
    }
  }, [onUnreadChange]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function respond(n: NotificationRow, accept: boolean) {
    setBusyId(n.id);
    try {
      await respondFriendRequest(n.id, accept);
      toast(accept ? "フレンドになりました" : "申請を辞退しました");
      await reload();
    } catch (e) {
      toast(`応答できませんでした: ${String(e)}`);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(n: NotificationRow) {
    setBusyId(n.id);
    try {
      await deleteNotification(n.id);
      await reload();
    } catch (e) {
      toast(`削除できませんでした: ${String(e)}`);
    } finally {
      setBusyId(null);
    }
  }

  function copyTableCode(code: string) {
    void navigator.clipboard
      .writeText(code)
      .then(() => toast(`📋 卓コードをコピー: ${code}`));
  }

  if (items === null) return <p className="muted friends-note">読み込み中…</p>;
  if (items.length === 0)
    return <p className="muted friends-note">新しいお知らせはありません。</p>;

  return (
    <div className="friends-inbox">
      {items.map((n) => {
        const from = String(n.payload["fromDisplayName"] ?? "");
        const ts = new Date(n.createdAt).toLocaleString();
        if (n.kind === "friend_request") {
          const responded = !!n.respondedAt;
          const accepted = !!n.payload["accepted"];
          return (
            <div key={n.id} className="friends-inbox-row">
              <p className="friends-inbox-title">
                <UserPlus size={13} /> フレンド申請: {from}
              </p>
              <p className="muted" style={{ fontSize: 11 }}>
                {ts}
              </p>
              {!responded ? (
                <div className="friends-inbox-actions">
                  <button
                    className="btn mini btn-primary"
                    disabled={busyId === n.id}
                    onClick={() => void respond(n, true)}
                  >
                    <Check size={13} /> 承認
                  </button>
                  <button
                    className="btn mini"
                    disabled={busyId === n.id}
                    onClick={() => void respond(n, false)}
                  >
                    <XIcon size={13} /> 辞退
                  </button>
                </div>
              ) : (
                <p className="muted" style={{ fontSize: 11 }}>
                  {accepted ? "承認済み" : "辞退済み"}
                  <button
                    className="btn mini"
                    style={{ marginLeft: 8 }}
                    disabled={busyId === n.id}
                    onClick={() => void remove(n)}
                  >
                    <Trash2 size={12} />
                  </button>
                </p>
              )}
            </div>
          );
        }
        if (n.kind === "friend_accepted") {
          return (
            <div key={n.id} className="friends-inbox-row">
              <p className="friends-inbox-title">
                <Check size={13} /> {from} があなたの申請を承認しました
              </p>
              <p className="muted" style={{ fontSize: 11 }}>
                {ts}
              </p>
              <div className="friends-inbox-actions">
                <button
                  className="btn mini"
                  disabled={busyId === n.id}
                  onClick={() => void remove(n)}
                >
                  <Trash2 size={12} /> 削除
                </button>
              </div>
            </div>
          );
        }
        if (n.kind === "table_invite") {
          const code = String(n.payload["code"] ?? "");
          const tableName = String(n.payload["tableName"] ?? "");
          return (
            <div key={n.id} className="friends-inbox-row">
              <p className="friends-inbox-title">
                <CalendarClock size={13} /> 卓招待: {tableName || "(無題の卓)"}
              </p>
              <p className="muted" style={{ fontSize: 11 }}>
                {from} · {ts}
              </p>
              <p style={{ fontSize: 12 }}>
                参加コード: <code className="friends-code">{code}</code>
              </p>
              <div className="friends-inbox-actions">
                <button
                  className="btn mini btn-primary"
                  onClick={() => onTableInvite(code, tableName)}
                >
                  この卓に入る
                </button>
                <button
                  className="btn mini"
                  onClick={() => copyTableCode(code)}
                >
                  <Copy size={12} /> コピー
                </button>
                <button
                  className="btn mini"
                  disabled={busyId === n.id}
                  onClick={() => void remove(n)}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          );
        }
        if (n.kind === "schedule_invite") {
          const token = String(n.payload["publicToken"] ?? "");
          const title = String(n.payload["title"] ?? "");
          const base =
            import.meta.env.VITE_WEB_BASE_URL ?? "http://localhost:3000";
          const url = `${base}/schedule/${token}`;
          return (
            <div key={n.id} className="friends-inbox-row">
              <p className="friends-inbox-title">
                <CalendarClock size={13} /> 日程調整: {title || "(無題)"}
              </p>
              <p className="muted" style={{ fontSize: 11 }}>
                {from} · {ts}
              </p>
              <div className="friends-inbox-actions">
                <button
                  className="btn mini btn-primary"
                  onClick={() => void openUrl(url)}
                >
                  ブラウザで開く
                </button>
                <button
                  className="btn mini"
                  disabled={busyId === n.id}
                  onClick={() => void remove(n)}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          );
        }
        if (n.kind === "tip_received") {
          const amount = Number(n.payload["amount"] ?? 0);
          const message = String(n.payload["message"] ?? "");
          return (
            <div key={n.id} className="friends-inbox-row">
              <p className="friends-inbox-title">
                <Heart size={13} /> スーパーサンクス: {amount.toLocaleString()} G
              </p>
              <p className="muted" style={{ fontSize: 11 }}>
                {from || "どなたか"} · {ts}
              </p>
              {message && (
                <p style={{ fontSize: 12.5 }} className="friends-inbox-msg">
                  「{message}」
                </p>
              )}
              <div className="friends-inbox-actions">
                <button
                  className="btn mini"
                  disabled={busyId === n.id}
                  onClick={() => void remove(n)}
                >
                  <Trash2 size={12} /> 削除
                </button>
              </div>
            </div>
          );
        }
        if (n.kind === "review_decision") {
          const title = String(n.payload["productTitle"] ?? "");
          const decision = String(n.payload["decision"] ?? "");
          const reason = String(n.payload["reason"] ?? "");
          const label =
            decision === "approved"
              ? "承認されました"
              : decision === "rejected"
                ? "却下されました"
                : "公開停止されました";
          return (
            <div key={n.id} className="friends-inbox-row">
              <p className="friends-inbox-title">
                <Check size={13} /> 審査結果: {title || "あなたの作品"}
              </p>
              <p className="muted" style={{ fontSize: 11 }}>
                {label} · {ts}
              </p>
              {reason && (
                <p style={{ fontSize: 12.5 }} className="friends-inbox-msg">
                  {reason}
                </p>
              )}
              <div className="friends-inbox-actions">
                <button
                  className="btn mini"
                  disabled={busyId === n.id}
                  onClick={() => void remove(n)}
                >
                  <Trash2 size={12} /> 削除
                </button>
              </div>
            </div>
          );
        }
        if (n.kind === "product_review") {
          const title = String(n.payload["productTitle"] ?? "");
          const stars = Number(n.payload["stars"] ?? 0);
          const comment = String(n.payload["comment"] ?? "");
          return (
            <div key={n.id} className="friends-inbox-row">
              <p className="friends-inbox-title">
                <Star size={13} /> レビュー: {title || "あなたの作品"}
              </p>
              <p className="muted" style={{ fontSize: 11 }}>
                {from || "購入者"} · {"★".repeat(Math.max(0, Math.min(5, stars)))} ·{" "}
                {ts}
              </p>
              {comment && (
                <p style={{ fontSize: 12.5 }} className="friends-inbox-msg">
                  「{comment}」
                </p>
              )}
              <div className="friends-inbox-actions">
                <button
                  className="btn mini"
                  disabled={busyId === n.id}
                  onClick={() => void remove(n)}
                >
                  <Trash2 size={12} /> 削除
                </button>
              </div>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

/* ===== フレンド選択ピッカー(他コンポーネントから再利用) ===== */

export function useFriendsList(): {
  loading: boolean;
  friends: FriendItem[];
  reload: () => Promise<void>;
} {
  const { session } = useAuth();
  const loggedIn = !!session;
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!loggedIn || !supabaseConfigured) {
      setFriends([]);
      return;
    }
    setLoading(true);
    try {
      const f = await fetchFriends();
      setFriends(f);
    } finally {
      setLoading(false);
    }
  }, [loggedIn]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { loading, friends, reload };
}

/**
 * フレンド選択モーダル(卓招待 / 日程調整から呼ぶ)。
 * 親が `open` で表示制御、`onSelect` で 1 人を選ぶ。複数選択が必要なら別途。
 */
export function FriendPickerModal({
  open,
  title,
  multi,
  onClose,
  onSelect,
}: {
  open: boolean;
  title: string;
  multi?: boolean;
  onClose: () => void;
  onSelect: (ids: string[]) => void;
}) {
  const { friends, loading } = useFriendsList();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) setSelected(new Set());
  }, [open]);

  const sorted = useMemo(
    () =>
      [...friends].sort((a, b) =>
        Number(b.online) - Number(a.online) ||
        (a.displayName || "").localeCompare(b.displayName || ""),
      ),
    [friends],
  );

  if (!open) return null;

  function toggle(id: string) {
    if (!multi) {
      onSelect([id]);
      onClose();
      return;
    }
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  return (
    <div className="set2-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="set2-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 440, padding: 16 }}
      >
        <header className="set2-head">
          <span className="set2-title">
            <Users size={16} /> {title}
          </span>
          <button className="set2-x" onClick={onClose} aria-label="閉じる">
            <XIcon size={16} />
          </button>
        </header>
        <div style={{ maxHeight: 360, overflowY: "auto", marginTop: 8 }}>
          {loading ? (
            <p className="muted" style={{ fontSize: 12 }}>読み込み中…</p>
          ) : sorted.length === 0 ? (
            <p className="muted" style={{ fontSize: 12 }}>
              フレンドがいません。フレンドパネルからコードで追加できます。
            </p>
          ) : (
            <div className="friends-list">
              {sorted.map((f) => (
                <button
                  key={f.id}
                  className={`friend-row friends-pick-row ${selected.has(f.id) ? "on" : ""}`}
                  onClick={() => toggle(f.id)}
                  type="button"
                >
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
                  {multi && (
                    <span className="friend-pick-check">
                      {selected.has(f.id) ? <Check size={14} /> : null}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        {multi && (
          <footer className="set2-foot" style={{ marginTop: 8 }}>
            <span className="muted">{selected.size} 人選択中</span>
            <button
              className="btn btn-primary"
              disabled={selected.size === 0}
              onClick={() => {
                onSelect([...selected]);
                onClose();
              }}
            >
              選択を確定
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}

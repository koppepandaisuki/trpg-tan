import { useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  ChevronDown,
  LogOut,
  Moon,
  Sun,
  Volume2,
  UserCog,
  ExternalLink,
  LifeBuoy,
  X,
} from "lucide-react";
import { useAuth } from "./useAuth";
import { signInWithGoogle, signOut } from "./auth";
import { supabase, supabaseConfigured } from "./supabase";

const WEB_BASE = (
  import.meta.env.VITE_WEB_BASE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

interface AccountMenuProps {
  theme: string;
  onToggleTheme: () => void;
  /** サウンド・効果音設定モーダルを開く。 */
  onOpenSound: () => void;
}

/**
 * 右上のアカウントメニュー。
 *
 * ログイン中はメールアドレスではなく「アイコン + 表示名」のチップを出し、
 * クリックでアカウント設定モーダルを開く。表示名/アイコンは web の
 * public_profiles(display_name / avatar_path)を優先し、無ければ Google の
 * user_metadata、最後にメールのローカル部にフォールバックする。
 */
export function AccountMenu({ theme, onToggleTheme, onOpenSound }: AccountMenuProps) {
  const { session, ready } = useAuth();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<{
    name: string | null;
    avatarUrl: string | null;
  }>({ name: null, avatarUrl: null });
  const [busy, setBusy] = useState(false);

  const userId = session?.user.id;

  useEffect(() => {
    if (!userId || !supabaseConfigured) {
      setProfile({ name: null, avatarUrl: null });
      return;
    }
    let active = true;
    void supabase
      .from("public_profiles")
      .select("display_name, avatar_path")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        const avatarUrl = data.avatar_path
          ? supabase.storage.from("avatars").getPublicUrl(data.avatar_path).data
              .publicUrl
          : null;
        setProfile({ name: data.display_name ?? null, avatarUrl });
      });
    return () => {
      active = false;
    };
  }, [userId]);

  if (!supabaseConfigured) {
    return (
      <span className="muted" style={{ fontSize: 11 }}>
        ログイン未設定
      </span>
    );
  }
  if (!ready) return <span className="muted" style={{ fontSize: 11 }}>…</span>;

  if (!session) {
    return (
      <button
        className="btn mini btn-primary"
        onClick={() => {
          setBusy(true);
          void signInWithGoogle().finally(() => setBusy(false));
        }}
        disabled={busy}
      >
        {busy ? "ブラウザを開いています…" : "Google でログイン"}
      </button>
    );
  }

  const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>;
  const email = session.user.email ?? "";
  const name =
    profile.name ||
    (typeof meta.name === "string" && meta.name) ||
    (typeof meta.full_name === "string" && meta.full_name) ||
    email.split("@")[0] ||
    "ユーザー";
  const avatarUrl =
    profile.avatarUrl ||
    (typeof meta.avatar_url === "string" ? meta.avatar_url : null) ||
    (typeof meta.picture === "string" ? meta.picture : null);
  const initial = name.slice(0, 1).toUpperCase();

  async function logout() {
    setBusy(true);
    try {
      await signOut();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        className="acct-chip"
        onClick={() => setOpen(true)}
        title="アカウント設定"
      >
        <span className="acct-av">
          {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{initial}</span>}
        </span>
        <span className="acct-name">{name}</span>
        <ChevronDown size={14} className="acct-caret" />
      </button>

      {open && (
        <div
          className="modal-overlay"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="modal-card acct-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="modal-head">
              <strong>アカウント設定</strong>
              <button
                className="btn mini"
                onClick={() => setOpen(false)}
                aria-label="閉じる"
              >
                <X size={14} />
              </button>
            </header>

            <div className="acct-id">
              <span className="acct-av lg">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" />
                ) : (
                  <span>{initial}</span>
                )}
              </span>
              <div className="acct-id-text">
                <span className="acct-id-name">{name}</span>
                <span className="acct-id-mail" title={email}>
                  {email}
                </span>
              </div>
            </div>

            <div className="acct-rows">
              <button
                className="acct-row"
                onClick={() => void openUrl(`${WEB_BASE}/settings`)}
              >
                <UserCog size={16} />
                <span className="acct-row-label">
                  プロフィール・アカウントを編集
                  <small>表示名 / アイコン / メール・パスワード(web)</small>
                </span>
                <ExternalLink size={14} className="acct-row-ext" />
              </button>

              <button className="acct-row" onClick={onToggleTheme}>
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                <span className="acct-row-label">
                  テーマ
                  <small>{theme === "dark" ? "ダーク" : "ライト"}</small>
                </span>
                <span className="acct-row-toggle">
                  {theme === "dark" ? "ライトへ" : "ダークへ"}
                </span>
              </button>

              <button
                className="acct-row"
                onClick={() => {
                  setOpen(false);
                  onOpenSound();
                }}
              >
                <Volume2 size={16} />
                <span className="acct-row-label">
                  サウンド・効果音設定
                  <small>判定音 / クリティカル・ファンブル音</small>
                </span>
              </button>

              <button
                className="acct-row"
                onClick={() => void openUrl(`${WEB_BASE}/help`)}
              >
                <LifeBuoy size={16} />
                <span className="acct-row-label">
                  ヘルプ・よくある質問
                  <small>使い方 / お問い合わせ(web)</small>
                </span>
                <ExternalLink size={14} className="acct-row-ext" />
              </button>
            </div>

            <button
              className="btn acct-logout"
              onClick={() => void logout()}
              disabled={busy}
            >
              <LogOut size={15} /> ログアウト
            </button>

            <p className="acct-foot muted">パラDa-iCE デスクトップ版</p>
          </div>
        </div>
      )}
    </>
  );
}

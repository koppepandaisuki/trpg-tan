import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useMyProfile } from "./useMyProfile";
import { signInWithGoogle } from "./auth";
import { supabaseConfigured } from "./supabase";

/**
 * 右上のアカウントチップ。ログイン中はメールではなく「アイコン + 表示名」を出し、
 * クリックで設定画面(アカウントタブ)を開く。未ログイン時はログインボタン。
 */
export function AccountMenu({ onOpen }: { onOpen: () => void }) {
  const { ready, loggedIn, name, avatarUrl, initial } = useMyProfile();
  const [busy, setBusy] = useState(false);

  if (!supabaseConfigured) {
    return (
      <span className="muted" style={{ fontSize: 11 }}>
        ログイン未設定
      </span>
    );
  }
  if (!ready) return <span className="muted" style={{ fontSize: 11 }}>…</span>;

  if (!loggedIn) {
    return (
      <button
        className="btn mini btn-primary"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void signInWithGoogle().finally(() => setBusy(false));
        }}
      >
        {busy ? "ブラウザを開いています…" : "Google でログイン"}
      </button>
    );
  }

  return (
    <button className="acct-chip" onClick={onOpen} title="アカウント・設定">
      <span className="acct-av">
        {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{initial}</span>}
      </span>
      <span className="acct-name">{name}</span>
      <ChevronDown size={14} className="acct-caret" />
    </button>
  );
}

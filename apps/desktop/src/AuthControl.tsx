import { useState } from "react";
import { useAuth } from "./useAuth";
import { openWebLogin, openWebSignup, signOut } from "./auth";
import { supabaseConfigured } from "./supabase";

/**
 * サイドバー下部のログイン状態コントロール。
 * 認証はオプション(キャラシはログイン無しでも使える)。ログインすると
 * 後続スライス(ライブラリ取込)が解放される。
 *
 * ログインはシステムブラウザの web ログイン画面に委譲する。これにより
 * メール/パスワードと Google の両方式が使え、かつ 1 回のログインで web と
 * アプリの両方がログイン済みになる(web 側の desktop-handoff が deep-link で
 * セッションをアプリへ返す)。
 */
export function AuthControl() {
  const { session, ready } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!supabaseConfigured) {
    return (
      <p className="muted" style={{ fontSize: 11 }}>
        ログイン未設定(VITE_SUPABASE_URL / ANON_KEY)
      </p>
    );
  }
  if (!ready) return <p className="muted" style={{ fontSize: 11 }}>…</p>;

  if (session) {
    return (
      <div className="auth-box">
        <div className="auth-user" title={session.user.email ?? ""}>
          <span className="auth-dot" />
          {session.user.email ?? "ログイン中"}
        </div>
        <button className="btn mini" onClick={() => void signOut()}>
          ログアウト
        </button>
      </div>
    );
  }

  async function login() {
    setBusy(true);
    setError(null);
    try {
      await openWebLogin();
    } catch (e) {
      setError("ログインを開始できませんでした");
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  async function signup() {
    setError(null);
    try {
      await openWebSignup();
    } catch (e) {
      setError("新規登録を開始できませんでした");
      console.error(e);
    }
  }

  return (
    <div className="auth-box">
      <button
        className="btn mini btn-primary"
        onClick={login}
        disabled={busy}
        style={{ width: "100%" }}
      >
        {busy ? "ブラウザを開いています…" : "ログイン"}
      </button>
      <button
        className="btn mini"
        onClick={signup}
        style={{ width: "100%" }}
      >
        新規登録
      </button>
      <p className="muted" style={{ fontSize: 10, lineHeight: 1.4 }}>
        ブラウザでログイン(メール / Google)すると自動でアプリに戻ります。
      </p>
      {error && (
        <p className="tag fail" style={{ fontSize: 10 }}>
          {error}
        </p>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { LogIn, X } from "lucide-react";
import { useAuth } from "./useAuth";
import { openWebLogin } from "./auth";
import { supabaseConfigured } from "./supabase";

/**
 * ログイン必須の操作で未ログインだったときに出す共通モーダル。
 *
 * Toasts と同じモジュールレベルの購読方式で、どこからでも
 * `requireLogin("卓を立てるにはログインが必要です")` で発火できる。
 * ログインが完了したら自動で閉じる(useAuth の session を監視)。
 *
 * 加えて、アプリ起動時に未ログインならホームで 1 回だけ自動でログイン誘導を
 * 出す(1 起動 1 回。閉じたら次の起動まで出さない)。
 *
 * App のルートに <LoginGate /> を 1 つだけ置く。
 */

const listeners = new Set<(reason: string | null) => void>();

/** ログイン誘導モーダルを出す(全画面共通)。reason は理由の一文。 */
export function requireLogin(reason?: string) {
  listeners.forEach((cb) => cb(reason ?? null));
}

// 起動時の自動プロンプトは 1 起動につき 1 回だけ(HMR や再マウントでも再表示しない)。
let welcomePromptShown = false;

const WELCOME_REASON =
  "ログインすると、購入した作品の同期・フレンド・マルチプレイ・AI アシスタントなど、すべての機能が使えるようになります。";

export function LoginGate() {
  const { session, ready } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const cb = (r: string | null) => {
      setReason(r);
      setOpen(true);
    };
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, []);

  // 起動時: 未ログインならホームで 1 回だけログイン誘導を出す。
  // ready(セッション確認完了)まで待ち、少し置いてから表示する
  // (起動直後のちらつき/初回描画のブロッキングを避ける)。
  useEffect(() => {
    if (!ready || session || !supabaseConfigured || welcomePromptShown) return;
    const t = window.setTimeout(() => {
      if (welcomePromptShown) return;
      welcomePromptShown = true;
      setReason(WELCOME_REASON);
      setOpen(true);
    }, 1500);
    return () => window.clearTimeout(t);
  }, [ready, session]);

  // ログインが完了したら自動で閉じる(ブラウザでログイン → deep-link で復帰)。
  useEffect(() => {
    if (session && open) setOpen(false);
  }, [session, open]);

  if (!open) return null;

  async function login() {
    setBusy(true);
    try {
      await openWebLogin();
    } catch (e) {
      console.error("[login-gate] openWebLogin failed", e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="login-gate-overlay"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
    >
      <div className="login-gate" onClick={(e) => e.stopPropagation()}>
        <button
          className="login-gate-x"
          onClick={() => setOpen(false)}
          aria-label="閉じる"
        >
          <X size={18} />
        </button>
        <div className="login-gate-icon">
          <LogIn size={26} />
        </div>
        <h2 className="login-gate-title">
          {reason === WELCOME_REASON
            ? "ログインしてはじめよう"
            : "ログインが必要です"}
        </h2>
        <p className="login-gate-desc">
          {reason ?? "この操作にはログインが必要です。"}
        </p>
        <button
          className="btn btn-primary login-gate-btn"
          onClick={() => void login()}
          disabled={busy}
        >
          {busy ? "ブラウザを開いています…" : "ログイン / 新規登録"}
        </button>
        <p className="login-gate-note">
          ブラウザでログイン(メール / Google)すると自動でアプリに戻ります。
        </p>
        {reason === WELCOME_REASON && (
          <button
            className="btn mini login-gate-later"
            onClick={() => setOpen(false)}
          >
            あとで
          </button>
        )}
      </div>
    </div>
  );
}

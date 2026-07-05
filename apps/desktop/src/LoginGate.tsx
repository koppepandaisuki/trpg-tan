import { useEffect, useState } from "react";
import { LogIn, X } from "lucide-react";
import { useAuth } from "./useAuth";
import { openWebLogin } from "./auth";

/**
 * ログイン必須の操作で未ログインだったときに出す共通モーダル。
 *
 * Toasts と同じモジュールレベルの購読方式で、どこからでも
 * `requireLogin("卓を立てるにはログインが必要です")` で発火できる。
 * ログインが完了したら自動で閉じる(useAuth の session を監視)。
 *
 * App のルートに <LoginGate /> を 1 つだけ置く。
 */

const listeners = new Set<(reason: string | null) => void>();

/** ログイン誘導モーダルを出す(全画面共通)。reason は理由の一文。 */
export function requireLogin(reason?: string) {
  listeners.forEach((cb) => cb(reason ?? null));
}

export function LoginGate() {
  const { session } = useAuth();
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
        <h2 className="login-gate-title">ログインが必要です</h2>
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
      </div>
    </div>
  );
}

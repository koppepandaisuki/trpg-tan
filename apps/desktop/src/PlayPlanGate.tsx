import { useEffect, useState } from "react";
import { X, Check, Crown, Sparkles } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  getMyAccount,
  setMyPlanTester,
  startPlanCheckout,
  type UserPlan,
} from "./account-remote";

/**
 * マルチ卓のホストが無料(basic)のときに出すプラン案内モーダル。/pricing と同じ
 * 配色(シアン→スカイ→インディゴ)の 3 カード。
 *
 * PLAY/Pro を選ぶと Settings の PlanSection と同じ実課金フローに乗る:
 *   1. startPlanCheckout → Stripe Checkout を外部ブラウザで開く。
 *      決済完了は redice://subscription/complete で戻り、ウィンドウの
 *      フォーカス復帰時にプランを再取得して自動で onUnlocked(共有再開)。
 *   2. 課金未構成(テスト環境)は従来どおり setMyPlanTester にフォールバック。
 * 管理者には出さない(呼び出し側でゲート免除)。
 */
type GatePlan = {
  key: UserPlan;
  code: string;
  label: string;
  price: string;
  accent: "cyan" | "sky" | "indigo";
  perks: string[];
  featured?: boolean;
};

const PLANS: GatePlan[] = [
  {
    key: "basic",
    code: "BASIC",
    label: "基本",
    price: "無料",
    accent: "cyan",
    perks: ["購入・ライブラリ", "キャラ作成・レビュー", "他の人の卓に参加"],
  },
  {
    key: "play",
    code: "PLAY",
    label: "プレイ",
    price: "¥500 / 月",
    accent: "sky",
    featured: true,
    perks: ["卓を立てる（ホスト）", "BGM・カットイン等 全機能", "フレンド無制限"],
  },
  {
    key: "pro",
    code: "PRO",
    label: "Pro",
    price: "¥980 / 月",
    accent: "indigo",
    perks: ["プレイの全部", "出品手数料 20% に優遇", "クラウド保存ほか（予定）"],
  },
];

export function PlayPlanGate({
  onClose,
  onUnlocked,
}: {
  onClose: () => void;
  /** PLAY/Pro に切り替わってホスト可能になったとき。 */
  onUnlocked: () => void;
}) {
  const [busy, setBusy] = useState<UserPlan | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // ブラウザで決済中(戻り待ち)。true の間はフォーカス復帰でプランを再取得する。
  const [awaiting, setAwaiting] = useState(false);

  // 決済ページを開いた後、アプリに戻ってきたら(deep-link 完了 or 手動で戻る)
  // プランを確認し、有効になっていればそのまま共有を再開する。
  useEffect(() => {
    if (!awaiting) return;
    async function check() {
      try {
        const acct = await getMyAccount();
        if (acct.isAdmin || acct.plan === "play" || acct.plan === "pro") {
          onUnlocked();
        }
      } catch {
        // 取得失敗は次のフォーカスで再試行。
      }
    }
    window.addEventListener("focus", check);
    return () => window.removeEventListener("focus", check);
  }, [awaiting, onUnlocked]);

  async function choose(p: GatePlan) {
    if (p.key === "basic") {
      onClose();
      return;
    }
    setBusy(p.key);
    setErr(null);
    try {
      const r = await startPlanCheckout(p.key);
      if (r.ok) {
        // 外部ブラウザで Stripe Checkout。完了後はフォーカス復帰時に自動解放。
        await openUrl(r.url);
        setAwaiting(true);
      } else if (r.reason === "not_configured") {
        // 課金未構成(テスト環境): 従来のテスター切替にフォールバック。
        const next = await setMyPlanTester(p.key);
        if (next === "play" || next === "pro") onUnlocked();
        else onClose();
      } else {
        setErr(r.message);
      }
    } catch (e) {
      setErr(
        e instanceof Error
          ? e.message
          : "切り替えに失敗しました（ログインが必要かもしれません）",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className="plan-gate-overlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="plan-gate" onClick={(e) => e.stopPropagation()}>
        <button className="plan-gate-x" onClick={onClose} aria-label="閉じる">
          <X size={18} />
        </button>

        <div className="plan-gate-head">
          <span className="plan-gate-spark">
            <Sparkles size={20} aria-hidden />
          </span>
          <h2>みんなで卓を立てる</h2>
          <p>
            参加コードを発行してホストするには <b>PLAY プラン以上</b> が必要です。
            テスト期間中は <b>無料</b> で選べます（参加コードで他の人の卓に入るのは
            無料のままできます）。
          </p>
        </div>

        <div className="plan-gate-cards">
          {PLANS.map((pl) => (
            <div
              key={pl.key}
              className={`plan-gate-card pg-${pl.accent} ${pl.featured ? "featured" : ""}`}
            >
              {pl.featured && (
                <span className="plan-gate-badge">
                  <Crown size={12} aria-hidden /> おすすめ
                </span>
              )}
              <div className="pg-code">{pl.code}</div>
              <div className="pg-label">{pl.label}</div>
              <div className="pg-price">{pl.price}</div>
              <ul className="pg-perks">
                {pl.perks.map((t) => (
                  <li key={t}>
                    <Check size={13} strokeWidth={3} aria-hidden /> {t}
                  </li>
                ))}
              </ul>
              <button
                className="pg-btn"
                disabled={busy !== null || awaiting}
                onClick={() => void choose(pl)}
              >
                {busy === pl.key
                  ? "処理中…"
                  : pl.key === "basic"
                    ? "このまま無料で"
                    : "このプランにする"}
              </button>
            </div>
          ))}
        </div>

        {err && <p className="plan-gate-err">{err}</p>}
        {awaiting && (
          <p className="plan-gate-foot" style={{ fontWeight: 700 }}>
            🌐 ブラウザで決済ページを開きました。お支払いが完了すると
            自動でロックが外れ、共有を開始できます。
          </p>
        )}
        {!awaiting && (
          <p className="plan-gate-foot">
            決済は外部ブラウザで安全に行われます（テスト環境では課金なしで
            切り替わります）。
          </p>
        )}
      </div>
    </div>
  );
}

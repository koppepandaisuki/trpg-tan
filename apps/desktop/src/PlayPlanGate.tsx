import { useState } from "react";
import { X, Check, Crown, Sparkles } from "lucide-react";
import { setMyPlanTester, type UserPlan } from "./account-remote";

/**
 * マルチ卓のホストが無料(basic)のときに出すプラン案内モーダル。/pricing と同じ
 * 配色(シアン→スカイ→インディゴ)の 3 カードで、その場でプランを切り替えられる
 * (テスト期間中は課金なし)。PLAY/Pro を選ぶと onUnlocked が呼ばれ、共有を再開する。
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

  async function choose(p: GatePlan) {
    if (p.key === "basic") {
      onClose();
      return;
    }
    setBusy(p.key);
    setErr(null);
    try {
      const next = await setMyPlanTester(p.key);
      if (next === "play" || next === "pro") onUnlocked();
      else onClose();
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
                disabled={busy !== null}
                onClick={() => void choose(pl)}
              >
                {busy === pl.key
                  ? "切替中…"
                  : pl.key === "basic"
                    ? "このまま無料で"
                    : "このプランにする"}
              </button>
            </div>
          ))}
        </div>

        {err && <p className="plan-gate-err">{err}</p>}
        <p className="plan-gate-foot">
          自動決済は準備中です。今は動作確認用に課金なしで切り替わります。
        </p>
      </div>
    </div>
  );
}

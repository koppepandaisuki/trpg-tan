import { Crown, Dices } from "lucide-react";
import { openExternalUrl as openUrl, WEB_BASE } from "./platform";

// WEB_BASE は platform.ts(Tauri=env / ブラウザ=同一オリジン相対)

/**
 * 参加者の「卓ダウンロード中」に出す自社プロモ。
 * 無料(basic / 未ログイン)参加者にだけ表示し、卓の受信が終わったら呼び出し側で
 * 自動的に消える(phase==="ready" になると status 画面ごと閉じる)。
 *
 * 2026-09 のストア廃止までは注目作品をローテーション表示していたが、作品売買を
 * やめたので「PLAYプランで自分も卓を立てよう」のアップセルだけを残した。
 * クリックは外部ブラウザで料金ページを開く(参加フローは止めない)。
 */
export function JoinPromo() {
  return (
    <div className="join-promo">
      <div className="join-promo-card placeholder">
        <Dices size={26} aria-hidden /> 卓のデータを受け取っています…
      </div>

      <button
        className="join-promo-upsell"
        onClick={() => void openUrl(`${WEB_BASE}/pricing`)}
        title="料金プランを見る"
      >
        <Crown size={13} aria-hidden /> PLAYプランなら自分も卓を立てられます
      </button>
    </div>
  );
}

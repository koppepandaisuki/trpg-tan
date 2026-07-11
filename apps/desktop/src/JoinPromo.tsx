import { useEffect, useState } from "react";
import { Sparkles, Store, Crown } from "lucide-react";
import { openExternalUrl as openUrl, WEB_BASE } from "./platform";
import { fetchStore, type StoreItem } from "./store-remote";

// WEB_BASE は platform.ts(Tauri=env / ブラウザ=同一オリジン相対)

/**
 * 参加者の「卓ダウンロード中」に出すハウス広告(編集ピックアップ版)。
 * 無料(basic / 未ログイン)参加者にだけ表示し、卓の受信が終わったら呼び出し側で
 * 自動的に消える(phase==="ready" になると status 画面ごと閉じる)。
 *
 * 第三者広告ではなく自社プロモ: ストアの注目作品をローテーション表示し、
 * 「PLAYプランで自分も卓を立てよう」のアップセルを添える。クリックは外部ブラウザで
 * ストア/料金ページを開く(参加フローは止めない)。将来この一覧を有料ピックアップ枠に
 * 差し替えられるよう、表示部分は items 配列だけに依存させてある。
 */
export function JoinPromo() {
  const [items, setItems] = useState<StoreItem[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetchStore({ sort: "published", page: 1 });
        if (active) setItems(res.items.slice(0, 8));
      } catch {
        // オフライン等は黙って無視(ローディング表示はそのまま続く)。
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // 数秒ごとに自動ローテーション。
  useEffect(() => {
    if (items.length <= 1) return;
    const t = window.setInterval(
      () => setIdx((i) => (i + 1) % items.length),
      4500,
    );
    return () => window.clearInterval(t);
  }, [items.length]);

  const cur = items[idx];

  return (
    <div className="join-promo">
      <div className="join-promo-head">
        <Sparkles size={14} aria-hidden /> 待っているあいだに — 注目の作品
      </div>

      {cur ? (
        <button
          className="join-promo-card"
          onClick={() => void openUrl(`${WEB_BASE}/store/${cur.slug}`)}
          title="ストアでこの作品を見る"
        >
          {cur.coverUrl ? (
            <img src={cur.coverUrl} alt="" draggable={false} />
          ) : (
            <div className="join-promo-noimg">
              <Store size={28} aria-hidden />
            </div>
          )}
          <div className="join-promo-meta">
            <div className="join-promo-title">{cur.title}</div>
            {cur.systemLabel && (
              <div className="join-promo-sys">{cur.systemLabel}</div>
            )}
            <div className="join-promo-price">
              {cur.priceJpy === 0
                ? "無料"
                : `¥${cur.priceJpy.toLocaleString("ja-JP")}`}
            </div>
          </div>
        </button>
      ) : (
        <div className="join-promo-card placeholder">
          <Store size={26} aria-hidden /> 作品を読み込み中…
        </div>
      )}

      {items.length > 1 && (
        <div className="join-promo-dots">
          {items.map((it, i) => (
            <span key={it.id} className={i === idx ? "on" : ""} />
          ))}
        </div>
      )}

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

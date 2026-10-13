import { useState } from "react";
import type { LinkStatus } from "./net";
import { readP2pPreference, writeP2pPreference } from "./net";

/**
 * 接続の種類(直結 / 中継)の表示と、P2P 直結を使うかの設定。Web 版
 * components/play/play-link-badge.tsx と同じ内容のデスクトップ版。
 *
 *   - 直結(P2P): GM と参加者がサーバーを経由せず直接つながる。いちばん速い。
 *     直結の相手(GM ⇔ 参加者)には互いの IP アドレスが伝わる。
 *   - 中継: サーバー(Supabase)を経由する。IP アドレスは相手に伝わらない。
 */
export function LinkBadge({
  status,
  onKick,
}: {
  status: LinkStatus | null;
  /** GM のとき: 参加者を退室させる(荒らし対策)。 */
  onKick?: (peer: { id: string; name: string }) => void;
}) {
  const [p2p, setP2p] = useState(readP2pPreference);
  if (!status) return null;
  const total = status.peers.length;
  const direct = status.peers.filter((p) => p.link === "p2p").length;
  const summary = status.relayOnly
    ? "すべて中継で送っています"
    : total === 0
      ? "参加者を待っています"
      : direct === total
        ? `全員と直結(${total}人)`
        : `直結 ${direct}人 / 中継・接続中 ${total - direct}人`;
  return (
    <div className="link-badge">
      <div className="link-badge-row">
        <span className={`link-dot ${total > 0 && direct === total ? "on" : ""}`} />
        <span>{summary}</span>
      </div>
      {status.peers.length > 0 && (
        <ul className="link-peers">
          {status.peers.map((p) => (
            <li key={p.id}>
              <span>{p.name || "参加者"}</span>
              <span>
                {p.link === "p2p" ? "直結" : p.link === "connecting" ? "接続中…" : "中継"}
                {onKick && (
                  <button
                    className="btn mini link-kick"
                    onClick={() => {
                      if (confirm(`「${p.name || "参加者"}」を卓から退室させますか？`)) onKick(p);
                    }}
                  >
                    退室
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      <label className="link-pref">
        <input
          type="checkbox"
          checked={p2p}
          onChange={(e) => {
            setP2p(e.target.checked);
            writeP2pPreference(e.target.checked);
          }}
        />
        直結(P2P)を使う
      </label>
      <p className="share-note">
        直結はサーバーを経由しないので速く、直結できない相手とは自動で中継に切り替わります。
        直結の相手には互いの IP アドレスが伝わります。設定の変更は次の接続から有効です。
      </p>
    </div>
  );
}

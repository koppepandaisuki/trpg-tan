"use client";

import { useState } from "react";
import { Zap, Radio, Loader2 } from "lucide-react";
import type { LinkStatus } from "@trpg/core";
import { readP2pPreference, writeP2pPreference } from "@/lib/play/net";

/**
 * 接続の種類の表示(直結 / 中継)と、P2P 直結を使うかの設定。
 *
 *   - 直結(P2P): GM と参加者がサーバーを経由せず直接つながる。いちばん速い。
 *     その代わり、直結の相手(GM ⇔ 参加者)には互いの IP アドレスが伝わる。
 *   - 中継: サーバー(Supabase)を経由する。IP アドレスは相手に伝わらない。
 *
 * 設定の変更は次に卓へ入ったときから効く(接続中の経路は切り替えない)。
 */
export function PlayLinkBadge({
  status,
  onKick,
}: {
  status: LinkStatus | null;
  /** GM のとき: 参加者を退室させる(荒らし対策)。 */
  onKick?: (peer: { id: string; name: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [p2p, setP2p] = useState(() =>
    typeof window === "undefined" ? true : readP2pPreference(),
  );
  if (!status) return null;

  const total = status.peers.length;
  const direct = status.peers.filter((p) => p.link === "p2p").length;
  const connecting = status.peers.some((p) => p.link === "connecting");
  const allDirect = total > 0 && direct === total;

  const label = status.relayOnly
    ? "中継"
    : total === 0
      ? "待機中"
      : allDirect
        ? "直結"
        : `直結 ${direct}/${total}`;
  const tone = allDirect
    ? "border-sky-200 bg-sky-50 text-sky-800"
    : "border-border bg-muted text-muted-foreground";

  return (
    <span className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] ${tone}`}
        title="接続の種類"
        aria-expanded={open}
      >
        {connecting ? (
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        ) : allDirect ? (
          <Zap className="h-3 w-3" aria-hidden />
        ) : (
          <Radio className="h-3 w-3" aria-hidden />
        )}
        {label}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-72 rounded-md border border-border bg-background p-3 text-xs shadow-lg">
          <p className="font-semibold">接続の種類</p>
          <ul className="mt-1.5 space-y-1">
            {status.peers.length === 0 && (
              <li className="text-muted-foreground">まだ誰もつながっていません</li>
            )}
            {status.peers.map((p) => (
              <li key={p.id} className="flex justify-between gap-2">
                <span className="truncate">{p.name || "参加者"}</span>
                <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                  {p.link === "p2p" ? "直結" : p.link === "connecting" ? "接続中…" : "中継"}
                  {onKick && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`「${p.name || "参加者"}」を卓から退室させますか？`)) onKick(p);
                      }}
                      className="rounded border border-red-200 px-1.5 text-[10px] text-red-700 hover:bg-red-50"
                    >
                      退室
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {onKick && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              荒らしが入り直してくる場合は「公開をやめる」→ もう一度公開すると、参加コードが変わります。
            </p>
          )}
          <p className="mt-2 leading-relaxed text-muted-foreground">
            直結はサーバーを経由しないので速く、直結できない相手とは自動で中継に
            切り替わります。直結の相手(GM と参加者)には互いの IP アドレスが伝わります。
          </p>
          <label className="mt-2 flex items-center gap-2">
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
          <p className="mt-1 text-[11px] text-muted-foreground">
            変更は次に卓へ入ったときから有効です。
          </p>
        </div>
      )}
    </span>
  );
}

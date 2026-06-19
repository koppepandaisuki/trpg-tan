import { useCallback, useEffect, useRef, useState } from "react";
import type { Panel } from "@trpg/core";
import type { Room } from "./net";

/**
 * ライブドラッグ(CCFOLIA 風の“ぬるぬる”)。ドラッグ中の駒座標を ephemeral で
 * 配信/受信し、表示に被せる。確定座標は state 同期(権威)が担保するので、ここは
 * 高頻度・ロスしてよい・順序不問。受信が途切れたら(=ドラッグ終了)失効して権威へ戻る。
 */

// ライブ座標がこの間更新されなければ「ドラッグ終了」とみなし、権威座標へ戻す。
// 期待 RTT + state 反映より十分長く取る(遅延が大きいと一瞬戻る)。
const LIVE_TTL_MS = 1200;
// 配信の間引き(~14Hz)。短い drag バーストでも Realtime のレート制限に優しい。
const SEND_INTERVAL_MS = 70;

type LiveEntry = { x: number; y: number; at: number };

export function useLiveDrag(room: Room | null) {
  const [live, setLive] = useState<Map<string, LiveEntry>>(() => new Map());
  const sentAtRef = useRef(0);

  // ルーム接続時にライブ受信を登録(ドラッグ中の駒座標)。
  useEffect(() => {
    if (!room) return;
    room.onLive((m) => {
      if (m.kind !== "drag") return;
      setLive((prev) => {
        const next = new Map(prev);
        next.set(m.panelId, { x: m.x, y: m.y, at: Date.now() });
        return next;
      });
    });
  }, [room]);

  /** ドラッグ中の座標を配信(間引き)。確定は別途 onMove(intent/event)が担保。 */
  const sendDrag = useCallback(
    (panelId: string, x: number, y: number) => {
      if (!room) return;
      const now = performance.now();
      if (now - sentAtRef.current < SEND_INTERVAL_MS) return;
      sentAtRef.current = now;
      room.sendLive({ kind: "drag", panelId, x, y });
    },
    [room],
  );

  /** 他者がドラッグ中の駒の座標を表示用に被せる(失効分は無視)。 */
  const overlay = useCallback(
    (panels: Panel[]): Panel[] => {
      if (live.size === 0) return panels;
      const now = Date.now();
      let changed = false;
      const out = panels.map((p) => {
        const l = live.get(p.id);
        if (l && now - l.at < LIVE_TTL_MS) {
          changed = true;
          return { ...p, pos: { x: l.x, y: l.y } };
        }
        return p;
      });
      return changed ? out : panels;
    },
    [live],
  );

  return { sendDrag, overlay };
}

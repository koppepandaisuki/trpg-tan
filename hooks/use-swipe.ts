"use client";

import { useCallback, useRef } from "react";

/**
 * 水平方向のスワイプを検出する hook。MediaGallery のモバイル UX のために
 * 作成したが、他カルーセル系 UI からも再利用可能な汎用実装。
 *
 * 動作:
 *  - onTouchStart: 開始位置 (x, y) を記録
 *  - onTouchMove: 30px 以上水平に動いたら「swiping 中」フラグを立てる
 *    (vertical の動きが優位なら無視 = スクロール優先)
 *  - onTouchEnd: 50px 以上水平に動いていれば左 / 右の callback を発火
 *  - getWasSwiping(): 直前のジェスチャが swipe だったかを返す
 *    (click handler から呼んで、swipe 中の tap を抑制する用途)
 *
 * threshold は MediaGallery 用に固定値で十分。将来必要なら options で
 * 受け取れるよう拡張可能。
 *
 * 戻り値の touch handlers は要素にそのまま spread すれば動く。
 */
export function useSwipe(args: {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}) {
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const swipingRef = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    startRef.current = { x: t.clientX, y: t.clientY };
    swipingRef.current = false;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!startRef.current) return;
    const t = e.touches[0];
    const dx = t.clientX - startRef.current.x;
    const dy = t.clientY - startRef.current.y;
    // 水平方向が垂直方向より優位かつ 30px 以上動いている → swiping 中
    if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) {
      swipingRef.current = true;
    }
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!startRef.current) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - startRef.current.x;
      const dy = t.clientY - startRef.current.y;
      startRef.current = null;

      // 閾値超え + 水平優位 → swipe 判定
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) {
          args.onSwipeRight();
        } else {
          args.onSwipeLeft();
        }
      }
    },
    [args],
  );

  /**
   * click event handler の中で「直前のジェスチャが swipe だったか」を
   * 確認するために使う。true なら click をスキップして swipe 中の tap を
   * 抑制する。読んだら自動で false に戻す(1 回の判定で消費)。
   */
  const consumeWasSwiping = useCallback(() => {
    const wasSwiping = swipingRef.current;
    swipingRef.current = false;
    return wasSwiping;
  }, []);

  return { onTouchStart, onTouchMove, onTouchEnd, consumeWasSwiping };
}

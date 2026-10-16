"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * AdSense の広告枠(1 つ)。表示してよいかは呼び出し側(AdArea)が判定する。
 * 広告であることが分かるよう「広告」の表示を付ける(景品表示法のステルス
 * マーケティング規制への配慮)。
 */
export function AdSlot({ client, slot }: { client: string; slot: string }) {
  const pushed = useRef(false);
  useEffect(() => {
    if (pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // 広告ブロッカー等で失敗しても画面は壊さない
    }
  }, []);
  return (
    <div className="mx-auto w-full max-w-3xl">
      <p className="mb-1 text-[10px] text-muted-foreground">広告</p>
      <ins
        className="adsbygoogle block"
        style={{ display: "block" }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}

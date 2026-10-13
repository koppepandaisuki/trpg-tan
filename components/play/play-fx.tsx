"use client";

import { useEffect } from "react";
import type { CutIn } from "@trpg/core";

/**
 * 演出オーバーレイ(カットイン / テロップ)。
 *
 * どちらも非ブロッキング(pointer-events:none)で、一定時間で自動的に消える。
 * 見た目・尺は desktop の CutIn.tsx / TextStock.tsx と揃えてある。
 * CSS は app/globals.css の `.cutin-*` / `.telop-*`。
 */

const CUTIN_MS = 2400;

/** 画面を横切るカットイン。効果音は GM が別途 audio(se)で配信する。 */
export function CutInOverlay({
  cutin,
  onDone,
}: {
  cutin: CutIn;
  onDone: () => void;
}) {
  useEffect(() => {
    const t = window.setTimeout(onDone, CUTIN_MS);
    return () => window.clearTimeout(t);
  }, [cutin, onDone]);

  return (
    <div className="cutin-overlay" aria-hidden>
      <div
        className="cutin-band"
        style={cutin.bg ? { background: hexToRgba(cutin.bg, 0.82) } : undefined}
      />
      {/* 卓のカットインは任意の URL/データを取りうるので next/image は使わない。 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="cutin-image" src={cutin.image} alt="" />
    </div>
  );
}

/** 文字数に応じた表示時間(2.8〜7 秒)。desktop と同じ式。 */
function telopMs(text: string): number {
  return Math.min(7000, Math.max(2800, 1800 + text.length * 90));
}

/** 画面中央の帯 + 大きな文字。 */
export function TelopOverlay({
  text,
  onDone,
}: {
  text: string;
  onDone: () => void;
}) {
  const ms = telopMs(text);

  useEffect(() => {
    const t = window.setTimeout(onDone, ms);
    return () => window.clearTimeout(t);
  }, [text, ms, onDone]);

  return (
    <div className="telop-overlay" aria-hidden>
      <div className="telop-band" style={{ animationDuration: `${ms}ms` }} />
      <p className="telop-text" style={{ animationDuration: `${ms}ms` }}>
        {text}
      </p>
    </div>
  );
}

/** #rgb / #rrggbb → rgba()。不正な値は帯の既定色に任せる(undefined)。 */
function hexToRgba(hex: string, alpha: number): string | undefined {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return undefined;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

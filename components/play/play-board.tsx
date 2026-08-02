"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Panel, PlayBoard as BoardState } from "@trpg/core";

/**
 * 盤面(Web 版)。背景マップ + グリッド + キャラ駒 / 画像オブジェクト。
 *
 * デスクトップ版と同じ「仮想ステージ 1280×720 を均一スケールで縮める」方式。
 * どの画面サイズでも全員がまったく同じ構図を見る(見切れが起きない)。
 * 座標は 0..1 の正規化で保持するので、画面サイズに依存しない。
 */

const STAGE_W = 1280;
const STAGE_H = 720;

/** 画像を持つ駒は実寸表示、持たない駒は色付きの円形マーカー。 */
function isImageObject(p: Panel): boolean {
  return !!p.portrait;
}

export function PlayBoard({
  board,
  panels,
  canDrag,
  onMove,
  onSelect,
  selectedId,
  liveDrag,
}: {
  board: BoardState | undefined;
  panels: Panel[];
  /** その駒を動かせるか(GM は全部、参加者は自分の駒のみ)。 */
  canDrag: (p: Panel) => boolean;
  /** ドラッグ確定(0..1 正規化座標)。 */
  onMove: (panelId: string, x: number, y: number) => void;
  /** ドラッグ中の座標(投げっぱなしのライブ配信用。任意)。 */
  liveDrag?: (panelId: string, x: number, y: number) => void;
  onSelect?: (panelId: string | null) => void;
  selectedId?: string | null;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [dragId, setDragId] = useState<string | null>(null);
  // ドラッグ中のローカル座標(確定前のプレビュー)。
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);

  // 利用可能幅から均一スケールを決める(常に 16:9 を保つ)。
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      setScale(w > 0 ? w / STAGE_W : 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ドラッグ中の pointermove / pointerup は window で拾う(駒の外に出ても追従)。
  useEffect(() => {
    if (!dragId) return;
    const el = wrapRef.current;
    if (!el) return;

    const toNorm = (ev: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return {
        x: clamp01((ev.clientX - r.left) / Math.max(1, r.width)),
        y: clamp01((ev.clientY - r.top) / Math.max(1, r.height)),
      };
    };
    const onMoveEv = (ev: PointerEvent) => {
      const p = toNorm(ev);
      setDragPos(p);
      liveDrag?.(dragId, p.x, p.y);
    };
    const onUp = (ev: PointerEvent) => {
      const p = toNorm(ev);
      onMove(dragId, p.x, p.y);
      setDragId(null);
      setDragPos(null);
    };
    window.addEventListener("pointermove", onMoveEv);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMoveEv);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragId, onMove, liveDrag]);

  // 重なり順(layer 昇順 = 末尾が前面)。
  const ordered = [...panels].sort((a, b) => (a.layer ?? 0) - (b.layer ?? 0));

  return (
    <div
      ref={wrapRef}
      className="relative w-full overflow-hidden rounded-xl border border-border bg-[#0f1720]"
      style={{ aspectRatio: `${STAGE_W} / ${STAGE_H}` }}
      onPointerDown={(e) => {
        // 盤面の余白クリックで選択解除。
        if (e.target === e.currentTarget) onSelect?.(null);
      }}
    >
      {/* 背景マップ */}
      {board?.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={board.image}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
          style={{ transform: `scale(${board.bgScale ?? 1})` }}
          draggable={false}
        />
      )}

      {/* グリッド */}
      {board?.grid !== false && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: `${(64 / STAGE_W) * 100}% ${(64 / STAGE_H) * 100}%`,
          }}
        />
      )}

      {/* 駒 */}
      {ordered.map((p) => {
        const pos =
          dragId === p.id && dragPos ? dragPos : (p.pos ?? { x: 0.5, y: 0.5 });
        const draggable = canDrag(p);
        const img = isImageObject(p);
        const size = (p.size ?? (img ? 140 : 56)) * scale;
        const height = p.height ? p.height * scale : undefined;
        return (
          <div
            key={p.id}
            role={draggable ? "button" : undefined}
            tabIndex={draggable ? 0 : undefined}
            aria-label={p.name}
            onPointerDown={(e) => {
              if (!draggable || p.locked) return;
              e.preventDefault();
              onSelect?.(p.id);
              setDragId(p.id);
              setDragPos({ x: pos.x, y: pos.y });
            }}
            className={[
              "absolute -translate-x-1/2 -translate-y-1/2 select-none",
              draggable && !p.locked ? "cursor-grab active:cursor-grabbing" : "",
              dragId === p.id ? "z-50" : "",
              selectedId === p.id ? "outline outline-2 outline-primary" : "",
              p.hidden ? "opacity-40" : "",
            ].join(" ")}
            style={{
              left: `${pos.x * 100}%`,
              top: `${pos.y * 100}%`,
              width: size,
              ...(height ? { height } : {}),
            }}
          >
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.portrait as string}
                alt={p.name}
                className="h-full w-full object-contain drop-shadow-lg"
                draggable={false}
              />
            ) : (
              <div
                className="flex aspect-square w-full items-center justify-center rounded-full text-[11px] font-bold text-white shadow-lg ring-2 ring-white/70"
                style={{ background: p.color }}
              >
                <span className="line-clamp-2 px-1 text-center leading-tight">
                  {p.name.slice(0, 6)}
                </span>
              </div>
            )}
            {/* 名前ラベル(画像駒のみ。円形駒は中に名前が入っている) */}
            {img && (
              <span className="pointer-events-none absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {p.name}
              </span>
            )}
          </div>
        );
      })}

      {/* 前景 */}
      {board?.foreground && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={board.foreground}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
          style={{ transform: `scale(${board.fgScale ?? 1})` }}
          draggable={false}
        />
      )}
    </div>
  );
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

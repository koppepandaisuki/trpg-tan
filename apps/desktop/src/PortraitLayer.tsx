import { useEffect, useMemo, useRef, useState } from "react";
import { UserSquare } from "lucide-react";
import type { Panel, PlayEvent } from "@trpg/core";

/**
 * 立ち絵レイヤー(CCFOLIA 風)。
 * メインチャンネルで直近に発言/ロールしたキャラの立ち絵(現在の差分)を
 * 盤面の下端に重ねて表示する。ログと駒から純粋に導出するので、内容は
 * 全員で一致する(@差分 切替も即反映)。
 *
 * 位置・大きさはキャラごとにドラッグ/リサイズで自由に変えられ、この端末の
 * localStorage に保存する(表示 ON/OFF も端末ローカル)。
 */

const TOGGLE_KEY = "trpg.portraits.v1";
const tfKey = (playId: string) => `trpg.portraits.tf.v1::${playId}`;
const MAX_SPEAKERS = 3;

/** 立ち絵の配置(x=中心の横位置 0..1 / y=下端からの px / h=高さ比 0..1)。 */
interface Tf {
  x: number;
  y: number;
  h: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function loadTf(playId: string): Record<string, Tf> {
  try {
    const raw = localStorage.getItem(tfKey(playId));
    const o = raw ? JSON.parse(raw) : {};
    return o && typeof o === "object" ? (o as Record<string, Tf>) : {};
  } catch {
    return {};
  }
}

export function PortraitLayer({
  log,
  panels,
  playId,
}: {
  log: PlayEvent[];
  panels: Panel[];
  /** 配置の保存キー(卓ごと)。 */
  playId: string;
}) {
  const [enabled, setEnabled] = useState(
    () => localStorage.getItem(TOGGLE_KEY) !== "0",
  );
  const [tf, setTf] = useState<Record<string, Tf>>(() => loadTf(playId));
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    id: string;
    mode: "move" | "resize";
    sx: number;
    sy: number;
    base: Tf;
  } | null>(null);

  useEffect(() => setTf(loadTf(playId)), [playId]);

  function toggle() {
    setEnabled((v) => {
      localStorage.setItem(TOGGLE_KEY, v ? "0" : "1");
      return !v;
    });
  }

  // 直近の発言者(メインのみ・GM 以外・立ち絵あり・秘匿でない)を最大 3 人。
  const speakers = useMemo(() => {
    const seen = new Set<string>();
    const out: Panel[] = [];
    for (let i = log.length - 1; i >= 0 && out.length < MAX_SPEAKERS; i--) {
      const ev = log[i];
      if (ev.kind !== "chat" && ev.kind !== "roll") continue;
      if (ev.channel) continue; // 個別チャットは出さない
      if (ev.actor === "GM" || seen.has(ev.actor)) continue;
      seen.add(ev.actor);
      const p = panels.find(
        (x) =>
          x.name === ev.actor &&
          !!x.portrait &&
          !x.hidden &&
          (x.stats.length > 0 || x.resources.length > 0),
      );
      if (p) out.push(p);
    }
    return out; // [0] = 最新の発言者
  }, [log, panels]);

  /** 既定配置(最新ほど右・手前)。保存があればそれを使う。 */
  function tfOf(id: string, i: number): Tf {
    return tf[id] ?? { x: 0.84 - i * 0.17, y: 0, h: 0.45 };
  }

  function startMove(e: React.PointerEvent, id: string, i: number) {
    if (e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = {
      id,
      mode: "move",
      sx: e.clientX,
      sy: e.clientY,
      base: tfOf(id, i),
    };
  }
  function startResize(e: React.PointerEvent, id: string, i: number) {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = {
      id,
      mode: "resize",
      sx: e.clientX,
      sy: e.clientY,
      base: tfOf(id, i),
    };
  }
  function onMove(e: React.PointerEvent) {
    const d = drag.current;
    const r = ref.current?.getBoundingClientRect();
    if (!d || !r) return;
    let cur: Tf;
    if (d.mode === "move") {
      cur = {
        x: clamp(d.base.x + (e.clientX - d.sx) / r.width, 0.05, 0.95),
        y: clamp(d.base.y - (e.clientY - d.sy), 0, r.height * 0.6),
        h: d.base.h,
      };
    } else {
      // 上へドラッグで拡大。
      cur = {
        x: d.base.x,
        y: d.base.y,
        h: clamp(d.base.h + (d.sy - e.clientY) / r.height, 0.15, 1.4),
      };
    }
    setTf((t) => ({ ...t, [d.id]: cur }));
  }
  function onUp() {
    if (!drag.current) return;
    drag.current = null;
    // 現在の状態を確定保存。
    setTf((t) => {
      try {
        localStorage.setItem(tfKey(playId), JSON.stringify(t));
      } catch {
        // 容量超過などは無視
      }
      return t;
    });
  }

  return (
    <>
      <button
        className={`portraits-toggle ${enabled ? "on" : ""}`}
        onClick={toggle}
        title={enabled ? "立ち絵を隠す" : "立ち絵を表示"}
        aria-pressed={enabled}
      >
        <UserSquare size={13} /> 立ち絵
      </button>

      {enabled && speakers.length > 0 && (
        <div
          className="portraits"
          ref={ref}
          onPointerMove={onMove}
          onPointerUp={onUp}
        >
          {speakers.map((p, i) => {
            const t = tfOf(p.id, i);
            return (
              <div
                key={`${p.id}-${p.portrait}`}
                className={`stage-portrait p${i}`}
                style={{
                  left: `${t.x * 100}%`,
                  bottom: t.y,
                  height: `${t.h * 100}%`,
                }}
                onPointerDown={(e) => startMove(e, p.id, i)}
                title={`${p.name} — ドラッグで移動 / 角をドラッグで拡大縮小`}
              >
                <img src={p.portrait ?? ""} alt="" draggable={false} />
                <span
                  className="stage-portrait-resize"
                  onPointerDown={(e) => startResize(e, p.id, i)}
                  title="ドラッグで大きさ変更"
                />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

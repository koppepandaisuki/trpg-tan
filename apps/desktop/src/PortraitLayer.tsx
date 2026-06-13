import { useMemo, useState } from "react";
import { UserSquare } from "lucide-react";
import type { Panel, PlayEvent } from "@trpg/core";

/**
 * 立ち絵レイヤー(CCFOLIA 風)。
 * メインチャンネルで直近に発言/ロールしたキャラの立ち絵(現在の差分)を
 * 盤面の下端に重ねて表示する。ログと駒から純粋に導出するので、
 * ネットワーク同期でも全員が同じ立ち絵を見る(チャットの @差分 切替も
 * panel.portrait 経由で即反映)。表示 ON/OFF はこの端末ローカル。
 */

const TOGGLE_KEY = "trpg.portraits.v1";
const MAX_SPEAKERS = 3;

export function PortraitLayer({
  log,
  panels,
}: {
  log: PlayEvent[];
  panels: Panel[];
}) {
  const [enabled, setEnabled] = useState(
    () => localStorage.getItem(TOGGLE_KEY) !== "0",
  );
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
        <div className="portraits" aria-hidden>
          {speakers.map((p, i) => (
            <img
              key={`${p.id}-${p.portrait}`}
              className={`stage-portrait p${i}`}
              src={p.portrait ?? ""}
              alt=""
              draggable={false}
            />
          ))}
        </div>
      )}
    </>
  );
}

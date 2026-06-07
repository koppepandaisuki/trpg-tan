import { useEffect, useRef, useState } from "react";
import type { PlayEvent, CoCCheckResult } from "@trpg/core";

/**
 * ログ + 入力欄(発言 / ダイス記法)。メイン卓と切り離し窓で共用する
 * プレゼンテーション部品。実際の適用(乱数消費=GM 権威)は呼び出し側に委ねる:
 *   - メイン卓: onChat/onFreeRoll で直接 dispatch
 *   - 切り離し窓: onChat/onFreeRoll で intent をメインへ送る
 */
export function LogView({
  log,
  onChat,
  onFreeRoll,
}: {
  log: PlayEvent[];
  onChat: (text: string) => void;
  onFreeRoll: (notation: string) => void;
}) {
  const [chat, setChat] = useState("");
  const [notation, setNotation] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  // ログが増えたら末尾へ自動スクロール。
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log.length]);

  function sendChat() {
    const t = chat.trim();
    if (!t) return;
    onChat(t);
    setChat("");
  }
  function rollFree() {
    const n = notation.trim();
    if (!n) return;
    onFreeRoll(n);
    setNotation("");
  }

  return (
    <>
      <div className="plog" ref={logRef}>
        {log.length === 0 ? (
          <p className="muted" style={{ padding: 8, fontSize: 12 }}>
            ここに判定・チャットのログが流れます。
          </p>
        ) : (
          log.map((ev) => <LogRow key={ev.id} ev={ev} />)
        )}
      </div>

      <div className="pinput">
        <div className="pinput-row">
          <input
            className="input"
            value={chat}
            onChange={(e) => setChat(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendChat()}
            placeholder="発言…"
          />
          <button className="btn mini" onClick={sendChat}>
            送信
          </button>
        </div>
        <div className="pinput-row">
          <input
            className="input"
            value={notation}
            onChange={(e) => setNotation(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && rollFree()}
            placeholder="ダイス記法（例: 2d6+1, 1d100）"
          />
          <button className="btn mini btn-primary" onClick={rollFree}>
            ロール
          </button>
        </div>
      </div>
    </>
  );
}

/** ログ 1 行のレンダリング(イベント種別で分岐)。 */
export function LogRow({ ev }: { ev: PlayEvent }) {
  if (ev.kind === "chat")
    return (
      <p className="logrow">
        <b className="log-actor">{ev.actor}</b>
        <span>{ev.text}</span>
      </p>
    );
  if (ev.kind === "roll") {
    const tone = ev.check ? levelTone(ev.check) : "";
    return (
      <p className="logrow">
        <b className="log-actor">{ev.actor}</b>
        <span className="log-roll">
          {ev.label} → 🎲 [{ev.dice.join(", ")}] = <b>{ev.total}</b>
          {ev.check && (
            <span className={`log-level ${tone}`}> {levelLabel(ev.check)}</span>
          )}
        </span>
      </p>
    );
  }
  if (ev.kind === "resource")
    return (
      <p className="logrow muted">
        <b className="log-actor">{ev.actor}</b>
        <span>
          {ev.label} {ev.delta >= 0 ? `+${ev.delta}` : ev.delta} → {ev.current}
        </span>
      </p>
    );
  if (ev.kind === "panel-add")
    return (
      <p className="logrow muted">
        <span>＋ {ev.panel.name} を卓に追加</span>
      </p>
    );
  if (ev.kind === "panel-remove")
    return (
      <p className="logrow muted">
        <span>− 駒を卓から外した</span>
      </p>
    );
  return (
    <p className="logrow muted">
      <span>{ev.kind === "system" ? ev.text : ""}</span>
    </p>
  );
}

function levelTone(r: CoCCheckResult): string {
  switch (r.level) {
    case "extreme":
      return "crit";
    case "special":
      return "gold";
    case "hard":
    case "regular":
      return "ok";
    case "fumble":
      return "fumble";
    default:
      return "fail";
  }
}

function levelLabel(r: CoCCheckResult): string {
  switch (r.level) {
    case "extreme":
      return "イクストリーム！";
    case "hard":
      return "ハード成功";
    case "regular":
      return "成功";
    case "special":
      return "スペシャル！";
    case "fumble":
      return "ファンブル…";
    default:
      return "失敗";
  }
}

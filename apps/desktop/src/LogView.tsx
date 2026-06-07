import { useEffect, useRef, useState } from "react";
import type { PlayEvent, CoCCheckResult } from "@trpg/core";

/** 発言者の選択肢(GM + 卓上の駒)。 */
export interface Speaker {
  id: string; // "GM" or panel id
  name: string;
}

/**
 * ログ + 入力欄。メイン卓と切り離し窓で共用。
 *  - 発言者を選んで(GM / キャラ / トークン)発言
 *  - 入力欄に 1d100<=70 / 2d6+1 / CCB<=50 等のダイスコマンドを打つと判定
 * 実際の適用(乱数消費=GM 権威)は onSend の呼び出し側に委ねる
 * (メイン=parse して dispatch、切り離し窓=intent をメインへ送る)。
 */
export function LogView({
  log,
  speakers,
  onSend,
}: {
  log: PlayEvent[];
  speakers: Speaker[];
  onSend: (speakerId: string, raw: string) => void;
}) {
  const [speakerId, setSpeakerId] = useState("GM");
  const [text, setText] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  // ログが増えたら末尾へ自動スクロール。
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log.length]);

  // 選択中の発言者が居なくなったら GM に戻す。
  useEffect(() => {
    if (!speakers.some((s) => s.id === speakerId)) setSpeakerId("GM");
  }, [speakers, speakerId]);

  function send() {
    const t = text.trim();
    if (!t) return;
    onSend(speakerId, t);
    setText("");
  }

  return (
    <>
      <div className="plog" ref={logRef}>
        {log.length === 0 ? (
          <p className="muted" style={{ padding: 8, fontSize: 12 }}>
            発言や判定がここに流れます。例: <code>1d100&lt;=70 目星</code> /{" "}
            <code>2d6+1</code>
          </p>
        ) : (
          log.map((ev) => <LogRow key={ev.id} ev={ev} />)
        )}
      </div>

      <div className="pinput">
        <div className="pinput-row">
          <select
            className="input pspeaker"
            value={speakerId}
            onChange={(e) => setSpeakerId(e.target.value)}
            title="発言者"
          >
            {speakers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="発言 / 1d100<=70 目星 / 2d6+1…"
          />
          <button className="btn mini btn-primary" onClick={send}>
            送信
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
          {ev.check === undefined && ev.success !== undefined && (
            <span className={`log-level ${ev.success ? "ok" : "fail"}`}>
              {" "}
              {ev.success ? "成功" : "失敗"}
            </span>
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

import { useEffect, useRef, type Ref } from "react";
import type { PlayEvent, CoCCheckResult } from "@trpg/core";

/** 発言者の選択肢(GM + 卓上の駒)。 */
export interface Speaker {
  id: string; // "GM" or panel id
  name: string;
}

/**
 * ログ + 入力欄。入力は親(PlayTable)が保持する制御コンポーネント。
 * 技能/パレットのクリックでこの入力欄にダイス式が流し込まれ、手で調整して
 * Enter / 送信で確定する(CCFOLIA のチャパレ挙動)。
 */
export function LogView({
  log,
  speakers,
  speakerId,
  text,
  onSpeakerChange,
  onTextChange,
  onSubmit,
  inputRef,
}: {
  log: PlayEvent[];
  speakers: Speaker[];
  speakerId: string;
  text: string;
  onSpeakerChange: (id: string) => void;
  onTextChange: (t: string) => void;
  onSubmit: () => void;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const logRef = useRef<HTMLDivElement>(null);

  // ログが増えたら末尾へ自動スクロール。
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log.length]);

  // 選択中の発言者が居なくなったら GM に戻す。
  useEffect(() => {
    if (!speakers.some((s) => s.id === speakerId)) onSpeakerChange("GM");
  }, [speakers, speakerId, onSpeakerChange]);

  return (
    <>
      <div className="plog" ref={logRef}>
        {log.length === 0 ? (
          <p className="muted" style={{ padding: 10, fontSize: 13 }}>
            発言や判定がここに流れます。技能ボタンを<b>クリック</b>で下の入力欄に式が入り、
            <b>ダブルクリック</b>で即ロールします。
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
            onChange={(e) => onSpeakerChange(e.target.value)}
            title="発言者"
          >
            {speakers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            ref={inputRef}
            className="input"
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSubmit()}
            placeholder="発言 / CC<=70 目星 / 2d6+1…"
          />
          <button className="btn mini btn-primary" onClick={onSubmit}>
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

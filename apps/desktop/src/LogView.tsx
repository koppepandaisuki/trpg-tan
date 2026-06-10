import { useEffect, useMemo, useRef, useState, type Ref } from "react";
import type { PlayEvent, CoCCheckResult } from "@trpg/core";

/** 発言者の選択肢(GM + 卓上の駒)。 */
export interface Speaker {
  id: string; // "GM" or panel id
  name: string;
}

type LogFilter = "all" | "chat" | "dice";

/**
 * ログ + 入力欄。入力は親(PlayTable)が保持する制御コンポーネント。
 *  - タブで「すべて / チャット / ダイス」を切替、並び順も昇降切替
 *  - 🔒 でシークレットダイス(見せる相手はチェックボックスで指定)
 *  - 技能/パレットのクリックで入力欄に式が入り、手で調整して送信
 */
export function LogView({
  log,
  speakers,
  speakerId,
  text,
  secret,
  visibleTo,
  onSpeakerChange,
  onTextChange,
  onSecretChange,
  onVisibleToChange,
  onSubmit,
  inputRef,
}: {
  log: PlayEvent[];
  speakers: Speaker[];
  speakerId: string;
  text: string;
  secret: boolean;
  visibleTo: string[];
  onSpeakerChange: (id: string) => void;
  onTextChange: (t: string) => void;
  onSecretChange: (v: boolean) => void;
  onVisibleToChange: (names: string[]) => void;
  onSubmit: () => void;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const [filter, setFilter] = useState<LogFilter>("all");
  const [newestFirst, setNewestFirst] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const shown = useMemo(() => {
    const filtered =
      filter === "all"
        ? log
        : log.filter((ev) =>
            filter === "chat" ? ev.kind === "chat" : ev.kind === "roll",
          );
    return newestFirst ? [...filtered].reverse() : filtered;
  }, [log, filter, newestFirst]);

  // ログが増えたら末尾へ自動スクロール(古い順表示のときだけ)。
  useEffect(() => {
    if (newestFirst) return;
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log.length, filter, newestFirst]);

  // 選択中の発言者が居なくなったら GM に戻す。
  useEffect(() => {
    if (!speakers.some((s) => s.id === speakerId)) onSpeakerChange("GM");
  }, [speakers, speakerId, onSpeakerChange]);

  function toggleViewer(name: string) {
    onVisibleToChange(
      visibleTo.includes(name)
        ? visibleTo.filter((n) => n !== name)
        : [...visibleTo, name],
    );
  }

  return (
    <>
      <div className="plog-tabs" role="tablist" aria-label="ログ表示">
        {(
          [
            ["all", "すべて"],
            ["chat", "💬 チャット"],
            ["dice", "🎲 ダイス"],
          ] as [LogFilter, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={filter === key}
            className={`plog-tab ${filter === key ? "active" : ""}`}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
        <button
          className="plog-sort"
          onClick={() => setNewestFirst((v) => !v)}
          title="並び順を切替"
        >
          {newestFirst ? "↑ 新しい順" : "↓ 古い順"}
        </button>
      </div>

      <div className="plog" ref={logRef}>
        {shown.length === 0 ? (
          <p className="muted" style={{ padding: 10, fontSize: 13 }}>
            {filter === "all" ? (
              <>
                発言や判定がここに流れます。技能ボタンを<b>クリック</b>
                で下の入力欄に式が入り、<b>ダブルクリック</b>で即ロールします。
              </>
            ) : (
              "このタブに表示できるログはまだありません。"
            )}
          </p>
        ) : (
          shown.map((ev) => <LogRow key={ev.id} ev={ev} />)
        )}
      </div>

      <div className="pinput">
        {secret && (
          <div className="pinput-secret">
            <span className="pinput-secret-label">❓ 出目を見せる相手:</span>
            {speakers
              .filter((s) => s.id !== "GM")
              .map((s) => (
                <label key={s.id} className="pinput-viewer">
                  <input
                    type="checkbox"
                    checked={visibleTo.includes(s.name)}
                    onChange={() => toggleViewer(s.name)}
                  />
                  {s.name}
                </label>
              ))}
            {speakers.length <= 1 && (
              <span className="muted" style={{ fontSize: 11 }}>
                (GM のみに見える)
              </span>
            )}
          </div>
        )}
        {/* 1 段目: 発言者 + シークレット切替 / 2 段目: 本文 + 送信。
            (1 行に詰めるとサイドバー幅で送信ボタンがはみ出すため分割) */}
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
          <button
            className={`btn mini psecret ${secret ? "on" : ""}`}
            onClick={() => onSecretChange(!secret)}
            title="シークレットダイス(出目を伏せる)"
            aria-pressed={secret}
          >
            ❓ シークレット
          </button>
        </div>
        <div className="pinput-row">
          <input
            ref={inputRef}
            className="input"
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSubmit()}
            placeholder="発言 / CC<=70 目星 / 2d6+1…"
          />
          <button className="btn mini btn-primary psend" onClick={onSubmit}>
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
      <p className={`logrow ${ev.secret ? "log-secret" : ""}`}>
        <b className="log-actor">{ev.actor}</b>
        <span className="log-roll">
          {ev.secret && (
            <span
              className="log-lock"
              title={
                ev.visibleTo && ev.visibleTo.length > 0
                  ? `公開: ${ev.visibleTo.join("・")}`
                  : "GM のみ"
              }
            >
              ❓
            </span>
          )}
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
          {ev.secret && (
            <span className="log-secret-note">
              {ev.visibleTo && ev.visibleTo.length > 0
                ? `（${ev.visibleTo.join("・")}に公開）`
                : "（GMのみ）"}
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

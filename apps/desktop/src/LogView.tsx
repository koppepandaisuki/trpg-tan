import { useEffect, useMemo, useRef, useState, type Ref } from "react";
import { DICE_BOTS, getDiceBot } from "@trpg/core";
import {
  CircleHelp,
  MessageSquare,
  Dices,
  Save,
  MessageCircle,
  Trash2,
  FileCode2,
  FileText,
  Copy,
} from "lucide-react";
import type { PlayEvent, CoCCheckResult } from "@trpg/core";
import { QuickRollBar } from "./QuickRollBar";

/** 発言者の選択肢(GM + 卓上の駒)。 */
export interface Speaker {
  id: string; // "GM" or panel id
  name: string;
}

type LogFilter = "all" | "chat" | "dice";

/** イベントの所属チャンネル(chat / roll 以外は常にメイン)。 */
function channelOf(ev: PlayEvent): string {
  if (ev.kind === "chat" || ev.kind === "roll") return ev.channel ?? "main";
  return "main";
}

/**
 * ログ(チャット欄)に残さない“運用イベント”。駒の移動・リサイズ・盤面/シーンの
 * 切替などは状態同期のためにイベント列には乗るが、会話ログとしては不要なので
 * 表示から除外する(空行が流れる / 移動のたびに更新されるのを防ぐ)。
 */
const LOG_HIDDEN_KINDS = new Set<PlayEvent["kind"]>([
  "panel-move",
  "panel-update",
  "board-set",
  "scene-select",
  "scene-add",
  "scene-rename",
  "scene-remove",
]);

/**
 * ログ + 入力欄。入力は親(PlayTable)が保持する制御コンポーネント。
 *  - チャンネル(メイン / キャラごとの個別チャット)を切替
 *  - タブで「すべて / チャット / ダイス」を切替、並び順も昇降切替
 *  - ❓ でシークレットダイス(見せる相手はチェックボックスで指定)
 *  - 技能/パレットのクリックで入力欄に式が入り、手で調整して送信
 */
export function LogView({
  log,
  speakers,
  speakerId,
  text,
  secret,
  visibleTo,
  channel,
  onChannelChange,
  onSpeakerChange,
  color,
  onColorChange,
  onTextChange,
  onSecretChange,
  onVisibleToChange,
  onSubmit,
  onQuickRoll,
  onExport,
  onExportHtml,
  onCopyLog,
  onClearLog,
  maskSecret = false,
  viewerName,
  viewerPanelNames,
  diceBot,
  onDiceBotChange,
  inputRef,
}: {
  log: PlayEvent[];
  speakers: Speaker[];
  speakerId: string;
  text: string;
  secret: boolean;
  visibleTo: string[];
  /** 表示/送信先チャンネル("main" or パネル id)。 */
  channel: string;
  onChannelChange: (id: string) => void;
  onSpeakerChange: (id: string) => void;
  /** 発言の文字色(CSS color)。 */
  color: string;
  onColorChange: (c: string) => void;
  onTextChange: (t: string) => void;
  onSecretChange: (v: boolean) => void;
  onVisibleToChange: (names: string[]) => void;
  onSubmit: () => void;
  /** クイックロール: 式を渡すと現在の発言者・設定で振る。未指定ならバー非表示。 */
  onQuickRoll?: (expr: string) => void;
  /** チャットログをテキストファイルへ書き出す(リプレイ保存)。 */
  onExport?: () => void;
  /** チャットログを整形 HTML で書き出す。 */
  onExportHtml?: () => void;
  /** チャットログをクリップボードへコピー。 */
  onCopyLog?: () => void;
  /** チャット/ログ履歴を全消去(GM のみ。未指定ならボタン非表示)。 */
  onClearLog?: () => void;
  /** 参加者ビュー: シークレットダイスの出目を伏せて表示する。 */
  maskSecret?: boolean;
  /** 自分の表示名。visibleTo に含まれるシークレットは伏せずに見せる。 */
  viewerName?: string;
  /**
   * 自分が操作するコマの名前一覧。GM はシークレットの「見せる相手」を
   * **コマ名** で選ぶので、参加者の入室名(viewerName)だけで照合すると
   * 「コマ名で指定されたが入室名が違って見えない」バグになる。
   * このリストのいずれかが visibleTo に含まれれば見える扱いにする。
   */
  viewerPanelNames?: string[];
  /** 卓のダイスボット id(システム別ダイス処理)。 */
  diceBot?: string;
  /** ダイスボット切替(GM のみ。未指定ならセレクタ非表示)。 */
  onDiceBotChange?: (id: string) => void;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const [filter, setFilter] = useState<LogFilter>("all");
  const [newestFirst, setNewestFirst] = useState(false);
  const [exportMenu, setExportMenu] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const shown = useMemo(() => {
    const inChannel = log.filter(
      (ev) => !LOG_HIDDEN_KINDS.has(ev.kind) && channelOf(ev) === channel,
    );
    const filtered =
      filter === "all"
        ? inChannel
        : inChannel.filter((ev) =>
            filter === "chat" ? ev.kind === "chat" : ev.kind === "roll",
          );
    return newestFirst ? [...filtered].reverse() : filtered;
  }, [log, filter, newestFirst, channel]);

  // チャンネル先のキャラが居なくなったらメインへ戻す。
  useEffect(() => {
    if (channel !== "main" && !speakers.some((s) => s.id === channel)) {
      onChannelChange("main");
    }
  }, [speakers, channel, onChannelChange]);

  // 表示行が増えたら末尾へ自動スクロール(古い順表示のときだけ)。
  // log.length ではなく表示後の件数を見る(駒の移動など非表示イベントでは動かさない)。
  useEffect(() => {
    if (newestFirst) return;
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown.length, filter, channel, newestFirst]);

  // 選択中の発言者が居なくなったら、自分(参加者)があれば自分へ、無ければ GM へ。
  useEffect(() => {
    if (!speakers.some((s) => s.id === speakerId)) {
      onSpeakerChange(speakers.some((s) => s.id === "self") ? "self" : "GM");
    }
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
            ["chat", "チャット"],
            ["dice", "ダイス"],
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
        {(onExport || onExportHtml || onCopyLog) && (
          <div className="plog-export">
            <button
              className="plog-sort"
              onClick={() => setExportMenu((v) => !v)}
              title="リプレイを書き出し / コピー"
            >
              <Save size={14} />
            </button>
            {exportMenu && (
              <>
                <div
                  className="plog-export-back"
                  onClick={() => setExportMenu(false)}
                />
                <div className="plog-export-menu">
                  {onExportHtml && (
                    <button
                      onClick={() => {
                        setExportMenu(false);
                        onExportHtml();
                      }}
                    >
                      <FileCode2 size={13} /> 整形リプレイ(HTML)
                    </button>
                  )}
                  {onExport && (
                    <button
                      onClick={() => {
                        setExportMenu(false);
                        onExport();
                      }}
                    >
                      <FileText size={13} /> テキスト(.txt)
                    </button>
                  )}
                  {onCopyLog && (
                    <button
                      onClick={() => {
                        setExportMenu(false);
                        onCopyLog();
                      }}
                    >
                      <Copy size={13} /> クリップボードにコピー
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
        {onClearLog && (
          <button
            className="plog-sort"
            onClick={onClearLog}
            title="チャット/ログ履歴を全消去（駒・盤面は残る）"
          >
            <Trash2 size={14} />
          </button>
        )}
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
          shown.map((ev) => (
            <LogRow
              key={ev.id}
              ev={ev}
              maskSecret={maskSecret}
              viewerName={viewerName}
              viewerPanelNames={viewerPanelNames}
            />
          ))
        )}
      </div>

      <div className="pinput">
        {secret && (
          <div className="pinput-secret">
            <span className="pinput-secret-label ibtn">
              <CircleHelp size={13} /> 出目を見せる相手:
            </span>
            {speakers
              .filter((s) => s.id !== "GM" && s.id !== "self")
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
        {/* 発言者 / 送信先 / 色(画像の構成)。ダイスボット・シークレットは次段。 */}
        <div className="pcompose">
          <label className="pfield">
            <span className="pfield-label">発言者</span>
            <select
              className="input pspeaker"
              value={speakerId}
              onChange={(e) => onSpeakerChange(e.target.value)}
            >
              {speakers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="pfield">
            <span className="pfield-label">送信先</span>
            <select
              className="input pdest"
              value={channel}
              onChange={(e) => onChannelChange(e.target.value)}
            >
              <option value="main">メイン</option>
              {speakers
                .filter((s) => s.id !== "GM" && s.id !== "self")
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}（個別）
                  </option>
                ))}
            </select>
          </label>
          <label className="pfield pfield-color">
            <span className="pfield-label">色</span>
            <input
              type="color"
              className="pcolor"
              value={color}
              onChange={(e) => onColorChange(e.target.value)}
              title="発言の文字色"
            />
          </label>
        </div>
        {channel !== "main" && (
          <p className="chan-note">
            <MessageCircle size={11} /> 個別チャット — ここの発言と出目はメインには流れません
          </p>
        )}
        <div className="pinput-row">
          {onDiceBotChange && (
            <select
              className="input pbot"
              value={diceBot ?? "generic"}
              onChange={(e) => onDiceBotChange(e.target.value)}
              title={`ダイスボット（システム別のダイス処理）\n例: ${getDiceBot(diceBot).help}`}
            >
              {DICE_BOTS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
          <button
            className={`btn mini psecret ${secret ? "on" : ""}`}
            onClick={() => onSecretChange(!secret)}
            title="シークレットダイス(出目を伏せる)"
            aria-pressed={secret}
          >
            <CircleHelp size={14} /> シークレット
          </button>
        </div>
        {onQuickRoll && <QuickRollBar onRoll={onQuickRoll} />}
        <div className="pinput-row">
          <input
            ref={inputRef}
            className="input"
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSubmit()}
            placeholder={`発言 / ${getDiceBot(diceBot).help.split("（")[0]} / 2d6+1…`}
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
export function LogRow({
  ev,
  maskSecret = false,
  viewerName,
  viewerPanelNames,
}: {
  ev: PlayEvent;
  maskSecret?: boolean;
  /** 自分の表示名。visibleTo に含まれていれば出目を見せる。 */
  viewerName?: string;
  /** 自分の操作するコマの名前一覧。visibleTo に含まれていれば見える。 */
  viewerPanelNames?: string[];
}) {
  if (ev.kind === "chat")
    return (
      <p className="logrow" style={ev.color ? { color: ev.color } : undefined}>
        <b className="log-actor">{ev.actor}</b>
        <span>{ev.text}</span>
      </p>
    );
  if (ev.kind === "roll") {
    // 参加者ビューではシークレットダイスの出目を伏せる
    // (「見せる相手」に自分 OR 自分が操作するコマ名が入っていれば見える)。
    // GM は visibleTo を「コマ名」で選ぶので、入室名(viewerName)だけでは
    // 一致せず参加者側が見えないバグになる。コマ名でも照合する。
    const visible = ev.visibleTo ?? [];
    const canPeek =
      (!!viewerName && visible.includes(viewerName)) ||
      (viewerPanelNames?.some((n) => visible.includes(n)) ?? false);
    if (maskSecret && ev.secret && !canPeek) {
      return (
        <p className="logrow log-secret">
          <b
            className="log-actor"
            style={ev.color ? { color: ev.color } : undefined}
          >
            {ev.actor}
          </b>
          <span className="log-roll">
            <CircleHelp size={12} /> シークレットダイス（出目は非公開）
          </span>
        </p>
      );
    }
    const tone = ev.check ? levelTone(ev.check) : "";
    return (
      <p className={`logrow ${ev.secret ? "log-secret" : ""}`}>
        <b
          className="log-actor"
          style={ev.color ? { color: ev.color } : undefined}
        >
          {ev.actor}
        </b>
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
              <CircleHelp size={11} />
            </span>
          )}
          {ev.label} → 🎲 [{ev.dice.join(", ")}] = <b>{ev.total}</b>
          {ev.check && (
            <span className={`log-level ${tone}`}> {levelLabel(ev.check)}</span>
          )}
          {/* ダイスボットの判定詳細(スペシャル/成功数 等)。あれば優先表示 */}
          {ev.detail ? (
            <span
              className={`log-level ${
                ev.success === undefined ? "" : ev.success ? "ok" : "fail"
              }`}
            >
              {" "}
              {ev.detail}
            </span>
          ) : (
            ev.check === undefined &&
            ev.success !== undefined && (
              <span className={`log-level ${ev.success ? "ok" : "fail"}`}>
                {" "}
                {ev.success ? "成功" : "失敗"}
              </span>
            )
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
  if (ev.kind === "turn-set")
    return (
      <p className="logrow log-turn">
        <span>{ev.label}</span>
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

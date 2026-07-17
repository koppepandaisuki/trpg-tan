import { useEffect, useState } from "react";
import { Heart, Droplet, Brain, Diamond, Eye, EyeOff, BookOpen } from "lucide-react";
import type { Panel, PanelResource, PanelStat } from "@trpg/core";

/** HP/MP/SAN 等のリソースに添えるアイコン(色は CSS の .res-* で)。 */
function resourceIcon(key: string) {
  const k = key.toLowerCase();
  if (k === "hp") return <Heart size={12} className="res-hp" />;
  if (k === "mp") return <Droplet size={12} className="res-mp" />;
  if (k === "san") return <Brain size={12} className="res-san" />;
  return <Diamond size={12} className="res-etc" />;
}

/** CoC 駒か(6版/7版)。表示・判定コマンドの流儀を分けるのに使う。 */
function isCoCPanel(panel: Panel): boolean {
  return (
    panel.systemId === "coc6" || panel.systemId === "coc7" || !!panel.edition
  );
}

/**
 * 能力値/技能の表示ラベル。CoC は慣習どおり能力値を英語キー(STR 等)で、
 * それ以外のシステムはそのシステム自身のラベル(身体 / 敏捷度B…)で表示する。
 * 内部キー(BODY 等)しか出ないと CoC 風の英語表記に見えてしまうため。
 */
function statLabel(s: PanelStat, panel: Panel): string {
  if (s.kind === "characteristic" && isCoCPanel(panel)) return s.key;
  return s.label || s.key;
}

/** 技能/能力の判定コマンド(CCFOLIA 風)。
 *  カスタムシステムは駒の checkTemplate({value} 置換)、CoC は CC<=目標値。 */
function cmdFor(s: PanelStat, panel: Panel): string {
  const label = statLabel(s, panel);
  if (panel.checkTemplate) {
    return `${panel.checkTemplate.replace(/\{value\}/g, String(s.target))} ${label}`;
  }
  // CoC 駒のみ CC<= で判定。汎用システムでテンプレ未設定なら、誤った CoC
  // コマンドを出さず「ラベル 値」を流して手で組み立てられるようにする。
  if (isCoCPanel(panel)) return `CC<=${s.target} ${label}`;
  return `${label} ${s.target}`;
}

/**
 * 卓上のキャラ駒(パネル)1 枚。サイドバーに固定表示。
 *  - 名前 + HP/MP/SAN(アイコン付き・増減)
 *  - 能力値/技能ボタン: シングルクリックで入力欄にダイス式を流し込み、
 *    ダブルクリックで即ロール(CCFOLIA のチャパレ挙動)
 *  - 自由編集のチャットパレット
 */
export function PlayPanel({
  panel,
  onResource,
  onRemove,
  onFill,
  onSend,
  onEditPalette,
  onSpeed,
  onToggleHidden,
  playerMode = false,
  allowRemove = false,
}: {
  panel: Panel;
  onResource: (panel: Panel, resource: PanelResource, delta: number) => void;
  onRemove: (panel: Panel) => void;
  /** クリック: 入力欄へダイス式を流し込む(この駒として)。 */
  onFill: (text: string) => void;
  /** ダブルクリック: 即ロール(この駒として)。 */
  onSend: (text: string) => void;
  onEditPalette: (text: string) => void;
  /** 速さ(行動順)の変更。サイドバー/盤面左上の並び順に反映される。 */
  onSpeed: (panel: Panel, speed: number) => void;
  /** 表示/非表示(秘匿)の切替。GM のみ。非表示中は参加者の画面から消える。 */
  onToggleHidden?: (panel: Panel) => void;
  /** 参加者ビュー(卓から外す × を隠す)。 */
  playerMode?: boolean;
  /** 参加者ビューでも × を出す(自分が登場させた駒を自分で片付ける)。 */
  allowRemove?: boolean;
}) {
  const characteristics = panel.stats.filter((s) => s.kind === "characteristic");
  const skills = panel.stats.filter((s) => s.kind === "skill");
  // キャラごとの折りたたみ。閉じている間はアイコン+名前+HP/MP/SAN+能力値の
  // 簡易表示だけにして、サイドバーを縦に節約する。
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`ppanel ${panel.hidden ? "ppanel-hidden" : ""}`}
      style={{ borderTopColor: panel.color }}
    >
      <div
        className="ppanel-head"
        onClick={() => setOpen((v) => !v)}
        title={open ? "クリックで折りたたむ" : "クリックで展開"}
      >
        <span className="ppanel-caret" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
        <div className="ppanel-portrait" style={{ background: panel.color }}>
          {panel.portrait ? <img src={panel.portrait} alt="" /> : <span>👤</span>}
        </div>
        <div className="ppanel-id">
          <strong className="ppanel-name">{panel.name}</strong>
          <span className="ppanel-sys">
            {panel.source === "token"
              ? "トークン"
              : (panel.systemName ??
                (panel.systemId === "coc6" ? "CoC 6版" : "CoC 7版"))}
          </span>
        </div>
        {!playerMode && onToggleHidden && (
          <button
            className="ppanel-eye"
            title={panel.hidden ? "盤面に表示する" : "盤面から隠す（GM・参加者とも）"}
            aria-label={panel.hidden ? "表示する" : "非表示にする"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleHidden(panel);
            }}
          >
            {panel.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
        {(!playerMode || allowRemove) && (
          <button
            className="ppanel-del"
            title={allowRemove ? "自分の駒を片付ける" : "卓から外す"}
            onClick={(e) => {
              e.stopPropagation();
              if (
                allowRemove &&
                !confirm(`「${panel.name}」を卓から片付けますか？`)
              )
                return;
              onRemove(panel);
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* 折りたたみ中のサマリ(読み取り専用): リソース + 基本能力値。 */}
      {!open && (
        <div className="ppanel-mini">
          {panel.resources.length > 0 && (
            <div className="pmini-res">
              {panel.resources.map((r) => (
                <span key={r.key} className="pmini-chip">
                  <span aria-hidden>{resourceIcon(r.key)}</span>
                  {r.current}
                  <i>/{r.max}</i>
                </span>
              ))}
            </div>
          )}
          {characteristics.length > 0 && (
            <div className="pmini-stats">
              {characteristics.map((s) => (
                <span key={s.key} className="pmini-stat" title={s.label}>
                  {statLabel(s, panel)}
                  <b>{s.target}</b>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {open && (
        <>
      {/* 速さ(行動順)。変更するとサイドバー/盤面左上が速さ順に並び替わる。 */}
      <div className="ppanel-speed">
        <span className="pres-label">
          <span className="pres-ic" aria-hidden>
            ⚡
          </span>
          速さ
        </span>
        <input
          className="input pspeed-input"
          type="number"
          value={panel.speed ?? ""}
          placeholder="–"
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) onSpeed(panel, v);
          }}
          title="行動順(大きいほど先)"
        />
      </div>

      {panel.resources.length > 0 && (
        <div className="ppanel-res">
          {panel.resources.map((r) => (
            <div key={r.key} className="pres">
              <span className="pres-label">
                <span className="pres-ic" aria-hidden>
                  {resourceIcon(r.key)}
                </span>
                {r.label}
              </span>
              <button
                className="pres-btn"
                onClick={() => onResource(panel, r, -1)}
                title="-1"
              >
                −
              </button>
              <span className="pres-val">
                {r.current}
                <span className="pres-max">/{r.max}</span>
              </span>
              <button
                className="pres-btn"
                onClick={() => onResource(panel, r, 1)}
                title="+1"
              >
                ＋
              </button>
            </div>
          ))}
        </div>
      )}

      {characteristics.length > 0 && (
        <div className="ppanel-stats">
          {characteristics.map((s) => (
            <button
              key={s.key}
              className="pstat"
              onClick={() => onFill(cmdFor(s, panel))}
              onDoubleClick={() => onSend(cmdFor(s, panel))}
              title={`${s.label} ─ クリック: 入力欄に / ダブルクリック: 即ロール（${cmdFor(s, panel)}）`}
            >
              {/* CoC は英語表記(STR 等)、他システムは各システムのラベル。 */}
              <span className="pstat-label">{statLabel(s, panel)}</span>
              <span className="pstat-val">{s.target}</span>
            </button>
          ))}
        </div>
      )}

      {skills.length > 0 && (
        <div className="ppanel-skills">
          {skills.map((s) => (
            <button
              key={s.key}
              className="pskill"
              onClick={() => onFill(cmdFor(s, panel))}
              onDoubleClick={() => onSend(cmdFor(s, panel))}
              title={`クリック: 入力欄に / ダブルクリック: 即ロール（${cmdFor(s, panel)}）`}
            >
              {s.label} <b>{s.target}</b>
            </button>
          ))}
        </div>
      )}

      <PalettePanel
        panel={panel}
        onFill={onFill}
        onSend={onSend}
        onEdit={onEditPalette}
      />

      {/* キャラシから引き継いだ職業/メモ/背景(読むだけ。編集は駒の右クリック)。 */}
      {panel.note?.trim() && <ProfileNote note={panel.note} />}
        </>
      )}
    </div>
  );
}

/** 駒の情報/メモ(キャラシのメモ・背景込み)を折りたたみで表示する。 */
function ProfileNote({ note }: { note: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ppanel-profile">
      <button
        className="ppanel-profile-head"
        onClick={() => setOpen((v) => !v)}
        title={open ? "閉じる" : "キャラシのメモ・背景を見る"}
      >
        <BookOpen size={12} aria-hidden />
        <span className="ppanel-section">プロフィール</span>
        <span className="ppanel-profile-caret" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open && <div className="ppanel-profile-body">{note}</div>}
    </div>
  );
}

interface PaletteLine {
  text: string;
  comment: boolean;
}

function parsePaletteLines(text: string): PaletteLine[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) =>
      l.startsWith("#") || l.startsWith("//")
        ? { text: l.replace(/^#+\s*|^\/\/\s*/, ""), comment: true }
        : { text: l, comment: false },
    );
}

/**
 * パレット行を「コマンド + ラベル」に分解する(表示用)。
 * "CC<=70 目星" → ラベル「目星」を主役に、式は小さく添える。
 * ダイス式に見えない行(セリフや自由テキスト)は null でそのまま表示。
 */
function splitPaletteLine(
  line: string,
): { cmd: string; label: string } | null {
  const sp = line.indexOf(" ");
  const head = sp === -1 ? line : line.slice(0, sp);
  const rest = sp === -1 ? "" : line.slice(sp + 1).trim();
  const looksCmd =
    /[<>=@]/.test(head) ||
    /^\d+[a-zA-Z]/.test(head) ||
    /^(CC|CCB|NC|SAN|RES|CBR|choice)/i.test(head);
  if (!looksCmd) return null;
  return { cmd: head, label: rest };
}

/** チャットパレット。クリックで入力欄へ、ダブルクリックで即送信。 */
function PalettePanel({
  panel,
  onFill,
  onSend,
  onEdit,
}: {
  panel: Panel;
  onFill: (line: string) => void;
  onSend: (line: string) => void;
  onEdit: (text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(panel.palette ?? "");
  // 編集モードを開かずに 1 行だけ足すクイック追加。
  const [quick, setQuick] = useState("");

  useEffect(() => {
    if (!editing) setDraft(panel.palette ?? "");
  }, [panel.palette, editing]);

  const lines = parsePaletteLines(panel.palette ?? "");

  function save() {
    onEdit(draft);
    setEditing(false);
  }
  function cancel() {
    setDraft(panel.palette ?? "");
    setEditing(false);
  }
  function importSkills() {
    // システムに応じた判定コマンド(CoC=CC<= / 汎用=checkTemplate)で取り込む。
    const text = panel.stats.map((s) => cmdFor(s, panel)).join("\n");
    setDraft((prev) => (prev.trim() ? `${prev.trim()}\n${text}` : text));
  }
  function addQuick() {
    const line = quick.trim();
    if (!line) return;
    const cur = (panel.palette ?? "").trim();
    onEdit(cur ? `${cur}\n${line}` : line);
    setQuick("");
  }

  return (
    <div className="ppanel-palette">
      <div className="ppanel-palette-head">
        <span className="ppanel-section">チャパレ</span>
        <button className="palette-edit" onClick={() => setEditing((v) => !v)}>
          {editing ? "閉じる" : "✎ 編集"}
        </button>
      </div>

      {editing ? (
        <div className="palette-editor">
          <textarea
            className="input"
            rows={5}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              "1 行 1 コマンド\n例: CC<=70 目星\n1d6+1 ダメージ\n# 見出し"
            }
          />
          <div className="palette-editor-actions">
            {panel.stats.length > 0 && (
              <button className="btn mini" onClick={importSkills}>
                技能を取り込む
              </button>
            )}
            <span style={{ flex: 1 }} />
            <button className="btn mini" onClick={cancel}>
              キャンセル
            </button>
            <button className="btn mini btn-primary" onClick={save}>
              保存
            </button>
          </div>
        </div>
      ) : (
        <>
          {lines.length === 0 ? (
            <p className="palette-empty muted">
              下の欄からコマンドを追加（クリックで入力欄に / ダブルクリックで即ロール）
            </p>
          ) : (
            <div className="palette-lines">
              {lines.map((ln, i) => {
                if (ln.comment) {
                  return (
                    <div key={i} className="palette-head-line">
                      {ln.text}
                    </div>
                  );
                }
                const parts = splitPaletteLine(ln.text);
                return (
                  <button
                    key={i}
                    className="palette-line"
                    onClick={() => onFill(ln.text)}
                    onDoubleClick={() => onSend(ln.text)}
                    title={`クリック: 入力欄に / ダブルクリック: 即ロール（${ln.text}）`}
                  >
                    {parts && parts.label ? (
                      <>
                        <span className="pl-label">{parts.label}</span>
                        <code className="pl-cmd">{parts.cmd}</code>
                      </>
                    ) : (
                      ln.text
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {/* 編集モードを開かずに 1 行追加(Enter でも確定)。 */}
          <div className="palette-quick">
            <input
              className="input"
              value={quick}
              onChange={(e) => setQuick(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addQuick();
                }
              }}
              placeholder="例: 1d100<=70 目星"
              title="チャットパレットに 1 行追加"
            />
            <button
              className="btn mini"
              onClick={addQuick}
              disabled={!quick.trim()}
              title="チャットパレットに追加"
            >
              ＋
            </button>
          </div>
        </>
      )}
    </div>
  );
}

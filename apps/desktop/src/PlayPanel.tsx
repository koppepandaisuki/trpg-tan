import { useEffect, useState } from "react";
import type { Panel, PanelResource, PanelStat } from "@trpg/core";

/** HP/MP/SAN 等のリソースに添えるアイコン。 */
function resourceIcon(key: string): string {
  const k = key.toLowerCase();
  if (k === "hp") return "❤️";
  if (k === "mp") return "🔷";
  if (k === "san") return "🧠";
  return "◆";
}

/** 技能/能力の判定コマンド(CCFOLIA 風)。CC<=目標値 ＋ ラベル。 */
function cmdFor(s: PanelStat): string {
  return `CC<=${s.target} ${s.label}`;
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
}: {
  panel: Panel;
  onResource: (panel: Panel, resource: PanelResource, delta: number) => void;
  onRemove: (panel: Panel) => void;
  /** クリック: 入力欄へダイス式を流し込む(この駒として)。 */
  onFill: (text: string) => void;
  /** ダブルクリック: 即ロール(この駒として)。 */
  onSend: (text: string) => void;
  onEditPalette: (text: string) => void;
}) {
  const characteristics = panel.stats.filter((s) => s.kind === "characteristic");
  const skills = panel.stats.filter((s) => s.kind === "skill");

  return (
    <div className="ppanel" style={{ borderTopColor: panel.color }}>
      <div className="ppanel-head">
        <div className="ppanel-portrait" style={{ background: panel.color }}>
          {panel.portrait ? <img src={panel.portrait} alt="" /> : <span>👤</span>}
        </div>
        <div className="ppanel-id">
          <strong className="ppanel-name">{panel.name}</strong>
          <span className="ppanel-sys">
            {panel.source === "token"
              ? "トークン"
              : panel.systemId === "coc6"
                ? "CoC 6版"
                : "CoC 7版"}
          </span>
        </div>
        <button
          className="ppanel-del"
          title="卓から外す"
          onClick={() => onRemove(panel)}
        >
          ×
        </button>
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
              onClick={() => onFill(cmdFor(s))}
              onDoubleClick={() => onSend(cmdFor(s))}
              title={`クリック: 入力欄に / ダブルクリック: 即ロール（CC<=${s.target}）`}
            >
              <span className="pstat-label">{s.label}</span>
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
              onClick={() => onFill(cmdFor(s))}
              onDoubleClick={() => onSend(cmdFor(s))}
              title={`クリック: 入力欄に / ダブルクリック: 即ロール（${s.target}）`}
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
    const text = panel.stats
      .map((s) => `CC<=${s.target} ${s.label}`)
      .join("\n");
    setDraft((prev) => (prev.trim() ? `${prev.trim()}\n${text}` : text));
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
      ) : lines.length === 0 ? (
        <p className="palette-empty muted">
          「✎ 編集」でコマンドを追加（クリックで入力欄に / ダブルクリックで即ロール）
        </p>
      ) : (
        <div className="palette-lines">
          {lines.map((ln, i) =>
            ln.comment ? (
              <div key={i} className="palette-head-line">
                {ln.text}
              </div>
            ) : (
              <button
                key={i}
                className="palette-line"
                onClick={() => onFill(ln.text)}
                onDoubleClick={() => onSend(ln.text)}
                title="クリック: 入力欄に / ダブルクリック: 即ロール"
              >
                {ln.text}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

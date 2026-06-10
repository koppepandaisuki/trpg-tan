import { useEffect, useState } from "react";
import type { Panel, PanelResource, PanelStat } from "@trpg/core";

/**
 * 卓上のキャラ駒(パネル)1 枚。ポートレート + 名前 + リソース(HP/SAN/MP の
 * 増減) + 判定ボタン(能力値/技能をクリックで 1D100) + チャットパレット。
 */
export function PlayPanel({
  panel,
  onRoll,
  onResource,
  onRemove,
  onPalette,
  onEditPalette,
}: {
  panel: Panel;
  onRoll: (panel: Panel, stat: PanelStat) => void;
  onResource: (panel: Panel, resource: PanelResource, delta: number) => void;
  onRemove: (panel: Panel) => void;
  /** パレット行をこの駒として送信。 */
  onPalette?: (line: string) => void;
  /** パレット本文(複数行)を保存。 */
  onEditPalette?: (text: string) => void;
}) {
  const characteristics = panel.stats.filter((s) => s.kind === "characteristic");
  const skills = panel.stats.filter((s) => s.kind === "skill");

  return (
    <div className="ppanel" style={{ borderTopColor: panel.color }}>
      <div className="ppanel-head">
        <div className="ppanel-portrait" style={{ background: panel.color }}>
          {panel.portrait ? <img src={panel.portrait} alt="" /> : <span>◆</span>}
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
              <span className="pres-label">{r.label}</span>
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
              onClick={() => onRoll(panel, s)}
              title={`${s.label} で 1D100 判定（目標 ${s.target}）`}
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
              onClick={() => onRoll(panel, s)}
              title={`${s.label} 判定（${s.target}）`}
            >
              {s.label} <b>{s.target}</b>
            </button>
          ))}
        </div>
      )}

      {onPalette && onEditPalette && (
        <PalettePanel panel={panel} onSend={onPalette} onEdit={onEditPalette} />
      )}
    </div>
  );
}

interface PaletteLine {
  text: string;
  comment: boolean;
}

/** パレット本文を行へ。先頭が # / // の行は見出し(クリック不可)。 */
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
 * チャットパレット。1 行 1 コマンドをクリックでこの駒として送信。
 * 「✎ 編集」で textarea。技能から雛形を取り込むボタンも。
 */
function PalettePanel({
  panel,
  onSend,
  onEdit,
}: {
  panel: Panel;
  onSend: (line: string) => void;
  onEdit: (text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(panel.palette ?? "");

  // 外部で palette が変わったら(別ウィンドウ編集など)反映。編集中は触らない。
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
      .map((s) => `1d100<=${s.target} ${s.label}`)
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
              "1 行 1 コマンド\n例: 1d100<=70 目星\n1d6+1 ダメージ\n# 見出し"
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
          「✎ 編集」でコマンドを追加（例: 1d100&lt;=70 目星）
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
                onClick={() => onSend(ln.text)}
                title={ln.text}
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

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { SceneInfo } from "@trpg/core";

const COLLAPSE_KEY = "trpg.scenebar.collapsed.v1";

/**
 * シーンバー。盤面(背景＋グリッド)を切り替える単位。
 * タブをクリックで切替、ダブルクリックで名前変更、× で削除。
 * シーンが多くて画面を圧迫する時は、左の ▾ で「ドロップダウン」表示に畳める
 * (任意・端末に保存)。BGM を紐付けたシーンは ♪ で示し、切替時に自動再生。
 */
export function SceneBar({
  scenes,
  activeId,
  onSelect,
  onAdd,
  onRename,
  onRemove,
}: {
  scenes: SceneInfo[];
  activeId: string | undefined;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });

  function toggleCollapse() {
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* 保存失敗は無視 */
      }
      return next;
    });
  }

  function startEdit(s: SceneInfo) {
    setEditingId(s.id);
    setDraft(s.name);
  }

  function commit() {
    if (editingId) {
      const name = draft.trim();
      if (name) onRename(editingId, name);
    }
    setEditingId(null);
  }

  // 畳めるのはシーンが 2 つ以上の時だけ(1 つなら畳む意味がない)。
  const canCollapse = scenes.length >= 2;

  // 折りたたみ表示: ドロップダウンで切替するコンパクト 1 行。
  if (canCollapse && collapsed) {
    return (
      <div className="scenebar collapsed" role="tablist" aria-label="シーン">
        <button
          type="button"
          className="scene-collapse"
          onClick={toggleCollapse}
          title="シーンを展開する"
          aria-label="シーンを展開"
        >
          <ChevronRight size={14} />
        </button>
        <span className="scenebar-label">シーン</span>
        <select
          className="input scene-select"
          value={activeId ?? ""}
          onChange={(e) => onSelect(e.target.value)}
          title="シーンを切替"
        >
          {scenes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.bgmId ? " ♪" : ""}
            </option>
          ))}
        </select>
        <span className="scene-count muted">{scenes.length}</span>
        <button
          type="button"
          className="scene-add"
          onClick={onAdd}
          title="シーンを追加"
          aria-label="シーンを追加"
        >
          ＋
        </button>
      </div>
    );
  }

  return (
    <div className="scenebar" role="tablist" aria-label="シーン">
      {canCollapse && (
        <button
          type="button"
          className="scene-collapse"
          onClick={toggleCollapse}
          title="シーンを畳む(ドロップダウン表示)"
          aria-label="シーンを畳む"
        >
          <ChevronDown size={14} />
        </button>
      )}
      <span className="scenebar-label">シーン</span>
      {scenes.map((s) => {
        const active = s.id === activeId;
        if (editingId === s.id) {
          return (
            <input
              key={s.id}
              className="input scene-edit"
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") setEditingId(null);
              }}
            />
          );
        }
        return (
          <div
            key={s.id}
            role="tab"
            aria-selected={active}
            className={`scene-tab ${active ? "active" : ""}`}
            onClick={() => onSelect(s.id)}
            onDoubleClick={() => startEdit(s)}
            title="クリックで切替・ダブルクリックで名前変更"
          >
            {s.board.image && <span className="scene-dot" aria-hidden />}
            <span className="scene-name">{s.name}</span>
            {s.bgmId && (
              <span className="scene-bgm" title="BGM 設定済み（切替で自動再生）" aria-hidden>
                ♪
              </span>
            )}
            {scenes.length > 1 && (
              <button
                type="button"
                className="scene-x"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(s.id);
                }}
                title="シーンを削除"
                aria-label={`${s.name} を削除`}
              >
                ×
              </button>
            )}
          </div>
        );
      })}
      <button
        type="button"
        className="scene-add"
        onClick={onAdd}
        title="シーンを追加"
        aria-label="シーンを追加"
      >
        ＋
      </button>
    </div>
  );
}

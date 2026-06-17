import { useState } from "react";
import type { SceneInfo } from "@trpg/core";

/**
 * シーンバー。盤面(背景＋グリッド)を切り替える単位。
 * タブをクリックで切替、ダブルクリックで名前変更、× で削除。
 * キャラ・チャットは卓で共有。BGM はシーンに紐付けておくと、切替時に
 * 自動再生される(♪ マークの付いたシーン)。
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

  return (
    <div className="scenebar" role="tablist" aria-label="シーン">
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

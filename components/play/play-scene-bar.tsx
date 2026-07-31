"use client";

import { Layers, Plus, Pencil, Trash2 } from "lucide-react";
import type { SceneInfo } from "@trpg/core";

/**
 * シーンバー(GM 専用)。
 *
 * シナリオは複数の場面で進むので、盤面(背景・グリッド)をシーンごとに
 * 持ち替えられるようにする。駒は卓に属したままなので、シーンを切り替えても
 * 登場中のキャラはそのまま(デスクトップ版と同じ挙動)。
 */
export function PlaySceneBar({
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
  onAdd: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
        <Layers className="h-3 w-3" aria-hidden />
        シーン
      </span>

      {scenes.map((s) => {
        const active = s.id === activeId;
        return (
          <span
            key={s.id}
            className={[
              "group inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition",
              active
                ? "border-primary bg-primary/10 font-semibold text-foreground"
                : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
            ].join(" ")}
          >
            <button
              onClick={() => onSelect(s.id)}
              aria-current={active ? "true" : undefined}
              title={active ? "表示中のシーン" : `「${s.name}」に切り替える`}
            >
              {s.name}
            </button>
            {active && (
              <button
                onClick={() => {
                  const name = prompt("シーン名", s.name);
                  if (name?.trim()) onRename(s.id, name.trim());
                }}
                title="シーン名を変更"
                className="text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-foreground"
              >
                <Pencil className="h-3 w-3" aria-hidden />
              </button>
            )}
            {scenes.length > 1 && (
              <button
                onClick={() => {
                  if (!confirm(`シーン「${s.name}」を削除しますか？`)) return;
                  onRemove(s.id);
                }}
                title="このシーンを削除"
                className="text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-red-600"
              >
                <Trash2 className="h-3 w-3" aria-hidden />
              </button>
            )}
          </span>
        );
      })}

      <button
        onClick={() => {
          const name = prompt("新しいシーンの名前", `シーン${scenes.length + 1}`);
          if (name?.trim()) onAdd(name.trim());
        }}
        title="シーンを追加"
        className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-xs text-muted-foreground transition hover:border-foreground/30 hover:text-foreground"
      >
        <Plus className="h-3 w-3" aria-hidden />
        追加
      </button>
    </div>
  );
}

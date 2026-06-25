import { useEffect, useRef, useState } from "react";
import { Plus, ChevronDown } from "lucide-react";
import type { SystemDef } from "@trpg/core";
import { getAllSystems } from "./systems-store";

/**
 * 「＋ 新規」キャラクター作成メニュー。CoC を特別扱いせず、追加済みの全システム
 * (CoC / ビルダーのプリセット / 自作)を 1 つのフラットな一覧として並べ、どれからでも
 * 対等に作成できる。CoC はエディタ内で 6版/7版 を切替。自作には「自作」タグを付ける。
 *
 * .chars-list が overflow:auto でクリップするため、メニューは fixed 配置にして
 * ボタンの矩形から座標を出す(クリッピングを回避)。
 */
export function NewCharacterMenu({
  onNewCoC,
  onNewGeneric,
}: {
  onNewCoC: () => void;
  onNewGeneric: (def: SystemDef) => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number }>({
    left: 0,
    top: 0,
  });
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setMenuPos({ left: r.left, top: r.bottom + 4 });
    setOpen(true);
  }

  // 開くたびに最新のシステム一覧(自作の追加・削除を反映)。CoC を先頭に置きつつ、
  // 見た目は他システムと同じ行にして“優遇”しない。自作だけ「自作」タグで識別。
  const items = open
    ? [
        {
          key: "coc",
          icon: "🐙",
          name: "クトゥルフ神話TRPG（6版 / 7版）",
          tag: null as string | null,
          pick: onNewCoC,
        },
        ...getAllSystems().map((s) => ({
          key: s.id,
          icon: s.icon ?? "🎲",
          name: s.name || "(名称未設定)",
          tag: s.preset === false ? "自作" : null,
          pick: () => onNewGeneric(s),
        })),
      ]
    : [];

  return (
    <div className="newchar" ref={wrapRef}>
      <button
        ref={btnRef}
        className="btn mini btn-primary newchar-btn"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Plus size={13} /> 新規 <ChevronDown size={12} />
      </button>
      {open && (
        <div
          className="newchar-menu"
          role="menu"
          style={{ left: menuPos.left, top: menuPos.top }}
        >
          <div className="newchar-group">システムを選んで作成</div>
          {items.map((it) => (
            <button
              key={it.key}
              className="newchar-opt"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                it.pick();
              }}
            >
              <span className="newchar-ic">{it.icon}</span>
              <span className="newchar-name">{it.name}</span>
              {it.tag && <span className="newchar-tag">{it.tag}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

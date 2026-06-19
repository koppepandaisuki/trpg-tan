import { useEffect, useRef, useState } from "react";
import { Plus, ChevronDown } from "lucide-react";
import type { SystemDef } from "@trpg/core";
import { getAllSystems } from "./systems-store";

/**
 * 「＋ 新規」キャラクター作成メニュー。CoC(6版/7版はエディタ内で切替)に加え、
 * ビルダーのプリセット(SW2.5 / DX3 / シノビガミ 等)や自作システムからも
 * キャラシを作成できる。一覧に出すのは getAllSystems()(自作＋プリセット)。
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

  // 開くたびに最新のシステム一覧(自作の追加・削除を反映)。
  const systems = open ? getAllSystems() : [];

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
          <div className="newchar-group">クトゥルフ神話TRPG</div>
          <button
            className="newchar-opt"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onNewCoC();
            }}
          >
            <span className="newchar-ic">🐙</span>
            <span className="newchar-name">CoC（6版 / 7版）</span>
          </button>

          <div className="newchar-group">その他のシステム</div>
          {systems.map((s) => (
            <button
              key={s.id}
              className="newchar-opt"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onNewGeneric(s);
              }}
            >
              <span className="newchar-ic">{s.icon ?? "🎲"}</span>
              <span className="newchar-name">{s.name || "(名称未設定)"}</span>
              {s.preset === false && <span className="newchar-tag">自作</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

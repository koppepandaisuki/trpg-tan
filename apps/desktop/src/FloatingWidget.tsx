import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { useWidgetLayout, type Rect } from "./widget-layout";

/**
 * 自由配置のフローティング・ウィジェット枠。
 *  - タイトルバーをドラッグで移動、右下ハンドルでリサイズ
 *  - クリック(ポインタダウン)で最前面へ
 *  - 位置/サイズ/重なりは WidgetLayout(localStorage)に保存
 *
 * Phase 1 はアプリ内(boundsRef の矩形内)に収める。Phase 2 で同じ枠を
 * 別ウィンドウへ「切り離す」拡張を被せる予定。
 */
export function FloatingWidget({
  id,
  title,
  icon,
  defaultRect,
  minW = 200,
  minH = 140,
  onClose,
  bodyClass,
  boundsRef,
  children,
}: {
  id: string;
  title: string;
  icon?: ReactNode;
  /** 既定矩形。bounds(キャンバスの実寸)から算出する関数も可。 */
  defaultRect: Rect | ((bounds: { w: number; h: number }) => Rect);
  minW?: number;
  minH?: number;
  onClose?: () => void;
  bodyClass?: string;
  boundsRef: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const layout = useWidgetLayout();
  const dragRef = useRef<{
    mode: "move" | "resize";
    dir?: "e" | "s" | "se";
    px: number;
    py: number;
    rect: Rect;
  } | null>(null);

  // 初回マウントで既定位置を確定。
  useEffect(() => {
    if (layout.has(id)) return;
    const b = boundsRef.current?.getBoundingClientRect();
    const bounds = { w: b?.width ?? 960, h: b?.height ?? 600 };
    const def = typeof defaultRect === "function" ? defaultRect(bounds) : defaultRect;
    layout.ensure(id, def);
    // id 固定。defaultRect/layout は初回のみ参照すれば十分。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const rect = layout.get(id);
  if (!rect) return null; // 既定確定までの 1 フレーム

  function bounds() {
    const b = boundsRef.current?.getBoundingClientRect();
    return { w: b?.width ?? 99999, h: b?.height ?? 99999 };
  }

  function startMove(e: React.PointerEvent) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest(".fwidget-x")) return; // ×ボタンは除外
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    layout.bringToFront(id);
    dragRef.current = { mode: "move", px: e.clientX, py: e.clientY, rect: rect! };
  }
  function startResize(e: React.PointerEvent, dir: "e" | "s" | "se") {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    layout.bringToFront(id);
    dragRef.current = { mode: "resize", dir, px: e.clientX, py: e.clientY, rect: rect! };
  }
  function onMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.px;
    const dy = e.clientY - d.py;
    const b = bounds();
    if (d.mode === "move") {
      // バーが見えるよう、画面外へ消えない範囲にクランプ。
      const x = Math.max(0, Math.min(d.rect.x + dx, Math.max(0, b.w - 48)));
      const y = Math.max(0, Math.min(d.rect.y + dy, Math.max(0, b.h - 32)));
      layout.set(id, { ...d.rect, x, y });
    } else {
      const dir = d.dir ?? "se";
      let w = d.rect.w;
      let h = d.rect.h;
      if (dir === "e" || dir === "se") {
        w = Math.max(minW, Math.min(d.rect.w + dx, b.w - d.rect.x));
      }
      if (dir === "s" || dir === "se") {
        h = Math.max(minH, Math.min(d.rect.h + dy, b.h - d.rect.y));
      }
      layout.set(id, { ...d.rect, w, h });
    }
  }
  function endDrag(e: React.PointerEvent) {
    if (!dragRef.current) return;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    dragRef.current = null;
  }

  return (
    <div
      className="fwidget"
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, zIndex: rect.z }}
      onPointerDown={() => layout.bringToFront(id)}
    >
      <div
        className="fwidget-bar"
        onPointerDown={startMove}
        onPointerMove={onMove}
        onPointerUp={endDrag}
      >
        {icon && <span className="fwidget-ic">{icon}</span>}
        <span className="fwidget-title">{title}</span>
        {onClose && (
          <button className="fwidget-x" onClick={onClose} title="閉じる" aria-label="閉じる">
            ×
          </button>
        )}
      </div>
      <div className={`fwidget-body ${bodyClass ?? ""}`}>{children}</div>

      {/* リサイズ: 右辺=幅 / 下辺=高さ / 右下角=両方。 */}
      <span
        className="fwidget-resize fwr-e"
        onPointerDown={(e) => startResize(e, "e")}
        onPointerMove={onMove}
        onPointerUp={endDrag}
        title="ドラッグで幅を変更"
      />
      <span
        className="fwidget-resize fwr-s"
        onPointerDown={(e) => startResize(e, "s")}
        onPointerMove={onMove}
        onPointerUp={endDrag}
        title="ドラッグで高さを変更"
      />
      <span
        className="fwidget-resize fwr-se"
        onPointerDown={(e) => startResize(e, "se")}
        onPointerMove={onMove}
        onPointerUp={endDrag}
        title="ドラッグでサイズ変更"
      />
    </div>
  );
}

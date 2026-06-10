import type { Panel } from "@trpg/core";

/**
 * ウィジェット・ランチャー(盤面の上のバー)。ログ / BGM / 各キャラを
 * 別ウィンドウで開く・前面化・閉じる。ウィジェットは画面内に浮かべず、
 * すべてここから窓として扱う。
 */
export function WidgetDock({
  cards,
  openIds,
  onOpen,
  onClose,
}: {
  cards: Panel[];
  openIds: Set<string>;
  onOpen: (id: string, title: string) => void;
  onClose: (id: string) => void;
}) {
  const items: { id: string; label: string; title: string; icon: string }[] = [
    { id: "log", label: "ログ", title: "ログ / チャット", icon: "📜" },
    { id: "bgm", label: "BGM", title: "BGM", icon: "♪" },
    ...cards.map((p) => ({
      id: `panel:${p.id}`,
      label: p.name,
      title: p.name,
      icon: "🎭",
    })),
  ];

  return (
    <div className="wdock" role="toolbar" aria-label="ウィジェット">
      <span className="wdock-label">ウィジェット</span>
      {items.map((it) => {
        const open = openIds.has(it.id);
        return (
          <div key={it.id} className={`wdock-chip ${open ? "open" : ""}`}>
            <button
              type="button"
              className="wdock-open"
              onClick={() => onOpen(it.id, it.title)}
              title={open ? "前面に表示" : "別ウィンドウで開く"}
            >
              <span className="wdock-ic" aria-hidden>
                {it.icon}
              </span>
              <span className="wdock-name">{it.label}</span>
              {open && <span className="wdock-dot" aria-hidden />}
            </button>
            {open && (
              <button
                type="button"
                className="wdock-x"
                onClick={() => onClose(it.id)}
                title="ウィンドウを閉じる"
                aria-label={`${it.label} を閉じる`}
              >
                ×
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

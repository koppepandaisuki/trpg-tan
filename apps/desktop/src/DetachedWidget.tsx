import { useEffect, useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { PlayPanel } from "./PlayPanel";
import { LogView } from "./LogView";
import {
  onSync,
  emitHello,
  emitRedock,
  sendIntent,
  type WidgetSlice,
} from "./play-bus";

/**
 * 切り離しウィンドウ(別モニター)で 1 つのウィジェットだけを描画するルート。
 * メイン卓の状態を `play:sync` で受け取り、自分の担当スライスを表示する。
 * 操作はローカルで処理せず intent をメインへ送り返す(GM 権威・乱数はメイン)。
 */
export function DetachedWidget({ widgetId }: { widgetId: string }) {
  const [slice, setSlice] = useState<WidgetSlice | null>(null);

  // メインからの同期を購読し、開いたことを知らせて初期状態を要求。
  useEffect(() => {
    let un: (() => void) | undefined;
    onSync((s) => setSlice(s)).then((f) => (un = f));
    void emitHello(widgetId);
    return () => un?.();
  }, [widgetId]);

  // この窓を閉じたら、メインへ「元に戻す(ドック)」を通知。
  useEffect(() => {
    const w = getCurrentWebviewWindow();
    let un: (() => void) | undefined;
    w.onCloseRequested(() => void emitRedock(widgetId)).then((f) => (un = f));
    return () => un?.();
  }, [widgetId]);

  if (!slice) {
    return <div className="dwindow dwindow-msg muted">メイン卓に接続中…</div>;
  }

  if (widgetId === "log") {
    return (
      <div className="dwindow dwindow-log">
        <LogView
          log={slice.log}
          onChat={(text) => void sendIntent({ kind: "chat", text })}
          onFreeRoll={(notation) =>
            void sendIntent({ kind: "free-roll", notation })
          }
        />
      </div>
    );
  }

  if (widgetId.startsWith("panel:")) {
    const pid = widgetId.slice("panel:".length);
    const panel = slice.panels.find((p) => p.id === pid);
    if (!panel) {
      return (
        <div className="dwindow dwindow-msg muted">
          このキャラは卓から外れました。ウィンドウを閉じてください。
        </div>
      );
    }
    return (
      <div className="dwindow dwindow-panel">
        <PlayPanel
          panel={panel}
          onRoll={(p, stat) =>
            void sendIntent({ kind: "roll", panelId: p.id, statKey: stat.key })
          }
          onResource={(p, r, delta) =>
            void sendIntent({
              kind: "resource",
              panelId: p.id,
              resourceKey: r.key,
              delta,
            })
          }
          onRemove={(p) =>
            void sendIntent({ kind: "remove-panel", panelId: p.id })
          }
        />
      </div>
    );
  }

  return (
    <div className="dwindow dwindow-msg muted">未知のウィジェット: {widgetId}</div>
  );
}

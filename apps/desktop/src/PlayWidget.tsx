import { useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { Undo2 } from "lucide-react";
import {
  WIDGET_DEFS,
  onSync,
  emitHello,
  emitRedock,
  sendIntent,
  type WidgetSlice,
} from "./play-bus";
import { LogView } from "./LogView";
import { PlayPanel } from "./PlayPanel";
import { TextStockPanel } from "./TextStock";
import { MemoPanel } from "./MemoPanel";
import { RulebookQA } from "./RulebookQA";
import { ScenarioViewer } from "./ScenarioViewer";
import { isTauri } from "./storage";

/**
 * PLAY サイドバーの切り離しウィンドウ(?widget=chat 等で開く別 OS ウィンドウ)。
 * メイン卓から play:sync で届くスライスを描画し、操作は intent で送り返す。
 * 状態の権威は常にメイン卓(このウィンドウは閉じても卓に影響しない)。
 */
export function PlayWidget({ widgetId }: { widgetId: string }) {
  const def = WIDGET_DEFS[widgetId];
  const [slice, setSlice] = useState<WidgetSlice | null>(null);

  // チャット入力(このウィンドウ内で完結するローカル状態)。
  const [speakerId, setSpeakerId] = useState("GM");
  const [text, setText] = useState("");
  const [secret, setSecret] = useState(false);
  const [visibleTo, setVisibleTo] = useState<string[]>([]);
  const [channel, setChannel] = useState("main");
  const [color, setColor] = useState(
    () => localStorage.getItem("trpg.chat.color.v1") || "#cdd3e1",
  );

  useEffect(() => {
    // メインと同じテーマで描画する。
    document.documentElement.dataset.theme =
      localStorage.getItem("trpg.theme.v1") ?? "light";
    if (!isTauri()) return; // ブラウザ直開き(dev)ではバス無し
    let un: UnlistenFn | null = null;
    void onSync((s) => setSlice(s)).then((u) => {
      un = u;
    });
    void emitHello(widgetId); // 最新スライスを要求
    return () => {
      un?.();
    };
  }, [widgetId]);

  // ウィンドウの × で閉じたときもメイン側をドックに戻す。
  useEffect(() => {
    if (!isTauri()) return;
    const onUnload = () => void emitRedock(widgetId);
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [widgetId]);

  const inputRef = useRef<HTMLInputElement>(null);

  function changeColor(c: string) {
    setColor(c);
    try {
      localStorage.setItem("trpg.chat.color.v1", c);
    } catch {
      // 保存失敗は無視
    }
  }

  function submit() {
    const t = text.trim();
    if (!t) return;
    void sendIntent({
      kind: "send",
      speakerId,
      raw: t,
      channel,
      secret,
      visibleTo,
      color,
    });
    setText("");
  }

  async function redock() {
    await emitRedock(widgetId);
    await getCurrentWindow().close();
  }

  let body = null;
  if (!slice) {
    body = (
      <p className="pwidget-wait muted">
        メイン卓に接続中… メインウィンドウで卓が開いている必要があります。
      </p>
    );
  } else if (widgetId === "chat") {
    body = (
      <div className="pside-log pwidget-log">
        <LogView
          log={slice.log}
          speakers={slice.speakers}
          speakerId={speakerId}
          text={text}
          secret={secret}
          visibleTo={visibleTo}
          channel={channel}
          onChannelChange={setChannel}
          color={color}
          onColorChange={changeColor}
          onSpeakerChange={setSpeakerId}
          onTextChange={setText}
          onSecretChange={setSecret}
          onVisibleToChange={setVisibleTo}
          onSubmit={submit}
          onQuickRoll={(expr) =>
            void sendIntent({
              kind: "send",
              speakerId,
              raw: expr,
              channel,
              secret,
              visibleTo,
              color,
            })
          }
          diceBot={slice.diceBot}
          inputRef={inputRef}
        />
      </div>
    );
  } else if (widgetId === "chars") {
    body = (
      <div className="ss-chars">
        {slice.cards.length === 0 ? (
          <p className="pside-empty muted">キャラクターがまだいません。</p>
        ) : (
          slice.cards.map((p) => (
            <PlayPanel
              key={p.id}
              panel={p}
              onResource={(panel, r, delta) =>
                void sendIntent({
                  kind: "resource",
                  panelId: panel.id,
                  resourceKey: r.key,
                  delta,
                })
              }
              onRemove={(panel) =>
                void sendIntent({ kind: "remove-panel", panelId: panel.id })
              }
              onFill={(t) =>
                void sendIntent({ kind: "fill", speakerId: p.id, text: t })
              }
              onSend={(t) =>
                void sendIntent({
                  kind: "send",
                  speakerId: p.id,
                  raw: t,
                  color,
                })
              }
              onEditPalette={(t) =>
                void sendIntent({
                  kind: "panel-update",
                  panelId: p.id,
                  patch: { palette: t },
                })
              }
              onSpeed={(panel, speed) =>
                void sendIntent({
                  kind: "panel-update",
                  panelId: panel.id,
                  patch: { speed },
                })
              }
              onToggleHidden={(panel) =>
                void sendIntent({
                  kind: "panel-update",
                  panelId: panel.id,
                  patch: { hidden: !panel.hidden },
                })
              }
            />
          ))
        )}
      </div>
    );
  } else if (widgetId === "stock") {
    body = (
      <TextStockPanel
        stock={slice.textStock}
        onFill={(t) =>
          void sendIntent({ kind: "fill", speakerId: "GM", text: t })
        }
        onSend={(t, se) => void sendIntent({ kind: "stock-send", text: t, se })}
        onTelop={(t, se) => void sendIntent({ kind: "telop", text: t, se })}
        onEdit={(t) => void sendIntent({ kind: "stock-edit", text: t })}
      />
    );
  } else if (widgetId === "memo") {
    body = (
      <MemoPanel
        playId={slice.playId}
        sharedMemos={slice.sharedMemos}
        onSharedMemosChange={(memos) =>
          void sendIntent({ kind: "shared-memos", memos })
        }
      />
    );
  } else if (widgetId === "rulebook") {
    body = <RulebookQA playId={slice.playId} />;
  } else if (widgetId === "scenario") {
    body = <ScenarioViewer playId={slice.playId} />;
  } else {
    body = <p className="pwidget-wait muted">不明なウィジェットです。</p>;
  }

  return (
    <div className="pwidget">
      <header className="pwidget-head">
        <strong className="pwidget-title">{def?.title ?? widgetId}</strong>
        {slice?.title && <span className="pwidget-table">{slice.title}</span>}
        <button
          className="btn mini"
          onClick={() => void redock()}
          title="サイドバーに戻す(このウィンドウを閉じる)"
        >
          <Undo2 size={13} /> メインに戻す
        </button>
      </header>
      <div className="pwidget-body">{body}</div>
    </div>
  );
}

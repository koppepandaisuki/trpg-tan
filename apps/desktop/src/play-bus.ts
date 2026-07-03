import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { Panel, PlayEvent, MemoPage } from "@trpg/core";

/**
 * PLAY サイドバーの「アプリ外(OS 別ウィンドウ)切り離し」の同期バス。
 *
 * 設計(GM 権威のミラー方式):
 *   - メイン卓(PlayTable)が権威。担当スライス(WidgetSlice)を `play:sync` で
 *     全ウィンドウへ配信し、切り離し窓は購読して描画するだけの鏡。
 *   - 窓側の操作は WidgetIntent として `play:action` へ送り返し、メインが
 *     既存のハンドラ(handleSend / updatePanel …)で適用する。乱数消費・
 *     マルチ配信・保存はすべてメインに集約され、整合が保たれる。
 *   - 窓が開いた直後は `play:hello` → メインが最新スライスを返す。
 *   - 「戻す」/ウィンドウを閉じる → `play:redock` でメインがドックに戻す。
 *
 * 音声系(BGM/SE)は切り離し対象外(別ウィンドウで鳴らすと二重再生になる)。
 */

/** 切り離し窓へ配信する軽量スライス。盤面画像・差分(variants)は載せない。 */
export interface WidgetSlice {
  playId: string;
  title: string;
  diceBot?: string;
  /** チャット: 表示ログ(直近のみ)と発言者候補。 */
  log: PlayEvent[];
  speakers: { id: string; name: string }[];
  /** キャラ駒(サイドバーカード用に盤面専用フィールドを落としたもの)。 */
  cards: Panel[];
  textStock: string;
  sharedMemos: MemoPage[];
}

/** 窓→メインへ送る操作。メインが既存ハンドラへ振り分ける。 */
export type WidgetIntent =
  | {
      kind: "send";
      speakerId: string;
      raw: string;
      channel?: string;
      secret?: boolean;
      visibleTo?: string[];
      color?: string;
    }
  /** メインウィンドウのチャット入力欄へ流し込む(発言者も切替)。 */
  | { kind: "fill"; speakerId: string; text: string }
  | { kind: "resource"; panelId: string; resourceKey: string; delta: number }
  | { kind: "remove-panel"; panelId: string }
  | {
      kind: "panel-update";
      panelId: string;
      patch: { palette?: string; speed?: number; hidden?: boolean };
    }
  | { kind: "stock-send"; text: string; se?: string }
  | { kind: "telop"; text: string; se?: string }
  | { kind: "stock-edit"; text: string }
  | { kind: "shared-memos"; memos: MemoPage[] };

/** 切り離しに対応するセクションと窓の既定サイズ/表示名。 */
export const WIDGET_DEFS: Record<
  string,
  { title: string; width: number; height: number }
> = {
  chat: { title: "チャット / ログ", width: 420, height: 660 },
  chars: { title: "キャラクター", width: 390, height: 660 },
  stock: { title: "テキスト", width: 420, height: 580 },
  memo: { title: "メモ", width: 400, height: 540 },
  rulebook: { title: "ルールブック Q&A", width: 430, height: 580 },
  scenario: { title: "シナリオ", width: 430, height: 620 },
};

const EV_SYNC = "play:sync";
const EV_HELLO = "play:hello";
const EV_ACTION = "play:action";
const EV_REDOCK = "play:redock";

/* ===== メイン(PlayTable)側 ===== */

export function emitSync(slice: WidgetSlice): Promise<void> {
  return emit(EV_SYNC, { slice });
}
export function onHello(cb: (widgetId: string) => void): Promise<UnlistenFn> {
  return listen<{ widgetId: string }>(EV_HELLO, (e) => cb(e.payload.widgetId));
}
export function onWidgetIntent(
  cb: (intent: WidgetIntent) => void,
): Promise<UnlistenFn> {
  return listen<WidgetIntent>(EV_ACTION, (e) => cb(e.payload));
}
export function onRedock(cb: (widgetId: string) => void): Promise<UnlistenFn> {
  return listen<{ widgetId: string }>(EV_REDOCK, (e) => cb(e.payload.widgetId));
}

/* ===== 切り離し窓側 ===== */

export function onSync(cb: (slice: WidgetSlice) => void): Promise<UnlistenFn> {
  return listen<{ slice: WidgetSlice }>(EV_SYNC, (e) => cb(e.payload.slice));
}
export function emitHello(widgetId: string): Promise<void> {
  return emit(EV_HELLO, { widgetId });
}
export function sendIntent(intent: WidgetIntent): Promise<void> {
  return emit(EV_ACTION, intent);
}
export function emitRedock(widgetId: string): Promise<void> {
  return emit(EV_REDOCK, { widgetId });
}

/* ===== ウィンドウ操作(メイン側から) ===== */

/** widgetId(chat / chars / …)を Tauri のラベル規則に収まる形へ。 */
export function widgetLabel(widgetId: string): string {
  return "pw-" + widgetId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

/** 切り離し窓を開く(既にあれば前面化)。閉じられたら onClosed を呼ぶ。 */
export async function openWidgetWindow(
  widgetId: string,
  title: string,
  size: { width: number; height: number },
  onClosed?: () => void,
): Promise<void> {
  const label = widgetLabel(widgetId);
  const existing = await WebviewWindow.getByLabel(label);
  if (existing) {
    await existing.setFocus();
    return;
  }
  const w = new WebviewWindow(label, {
    url: `index.html?widget=${encodeURIComponent(widgetId)}`,
    title,
    width: size.width,
    height: size.height,
    minWidth: 260,
    minHeight: 200,
    resizable: true,
  });
  await new Promise<void>((resolve, reject) => {
    void w.once("tauri://created", () => resolve());
    void w.once("tauri://error", (e) => reject(new Error(String(e.payload))));
  });
  if (onClosed) void w.once("tauri://destroyed", () => onClosed());
}

/** 切り離し窓を閉じる(無ければ何もしない)。 */
export async function closeWidgetWindow(widgetId: string): Promise<void> {
  const w = await WebviewWindow.getByLabel(widgetLabel(widgetId));
  if (w) await w.close().catch(() => {});
}

/** 全切り離し窓を閉じる(卓を離れるとき)。 */
export async function closeAllWidgetWindows(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => closeWidgetWindow(id)));
}

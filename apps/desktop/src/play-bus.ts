import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { PlayScene, BgmTrack } from "@trpg/core";

/**
 * 切り離しウィジェット(別ウィンドウ/別モニター)とメイン卓の同期バス。
 *
 * 設計:
 *   - メイン卓が権威(authority)。state(PlayScene)を保持し、変更を
 *     `play:sync` で全ウィンドウへ配信する。
 *   - 切り離し窓は購読して自分の担当スライスだけ描画する(読み取り専用の鏡)。
 *   - 窓側の操作は「意図(PlayIntent)」を `play:action` で送り返し、メインが
 *     正規のイベント(乱数消費=GM 権威)に変換して適用する。これでダイスの
 *     決定論・ログ整合が保たれる。
 *   - 窓が開いた直後は `play:hello` を投げ、メインが最新 state を返す。
 *   - 窓を閉じる時は `play:redock` を投げ、メインが「ドック(再合体)」に戻す。
 */

/** 切り離し窓へ配信する軽量スライス(盤面画像など重いものは載せない)。 */
export type WidgetSlice = Pick<
  PlayScene,
  "id" | "title" | "systemId" | "panels" | "log" | "bgm"
>;

/** 窓→メインへ送る操作の意図。乱数はメイン側で消費する。 */
export type PlayIntent =
  | { kind: "roll"; panelId: string; statKey: string }
  | { kind: "resource"; panelId: string; resourceKey: string; delta: number }
  | { kind: "remove-panel"; panelId: string }
  | { kind: "send"; speakerId: string; raw: string }
  | { kind: "bgm-add"; tracks: BgmTrack[] }
  | { kind: "bgm-remove"; id: string };

const EV_SYNC = "play:sync";
const EV_HELLO = "play:hello";
const EV_ACTION = "play:action";
const EV_REDOCK = "play:redock";

export function slimScene(s: PlayScene): WidgetSlice {
  return {
    id: s.id,
    title: s.title,
    systemId: s.systemId,
    panels: s.panels,
    log: s.log,
    bgm: s.bgm,
  };
}

/* ===== メイン側 ===== */

export function emitSync(scene: PlayScene): Promise<void> {
  return emit(EV_SYNC, { scene: slimScene(scene) });
}
export function onHello(cb: () => void): Promise<UnlistenFn> {
  return listen(EV_HELLO, () => cb());
}
export function onIntent(cb: (intent: PlayIntent) => void): Promise<UnlistenFn> {
  return listen<PlayIntent>(EV_ACTION, (e) => cb(e.payload));
}
export function onRedock(cb: (widgetId: string) => void): Promise<UnlistenFn> {
  return listen<{ widgetId: string }>(EV_REDOCK, (e) => cb(e.payload.widgetId));
}

/* ===== 切り離し窓側 ===== */

export function onSync(cb: (slice: WidgetSlice) => void): Promise<UnlistenFn> {
  return listen<{ scene: WidgetSlice }>(EV_SYNC, (e) => cb(e.payload.scene));
}
export function emitHello(widgetId: string): Promise<void> {
  return emit(EV_HELLO, { widgetId });
}
export function sendIntent(intent: PlayIntent): Promise<void> {
  return emit(EV_ACTION, intent);
}
export function emitRedock(widgetId: string): Promise<void> {
  return emit(EV_REDOCK, { widgetId });
}

/* ===== ウィンドウ操作 ===== */

/** widgetId(panel:uuid など)を Tauri のラベル規則に収まる形へ。 */
export function widgetLabel(widgetId: string): string {
  return "pw-" + widgetId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

/** 切り離し窓を開く(既にあれば前面化)。 */
export async function openWidgetWindow(
  widgetId: string,
  title: string,
  size?: { width?: number; height?: number },
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
    width: size?.width ?? 360,
    height: size?.height ?? 460,
    minWidth: 240,
    minHeight: 180,
    resizable: true,
  });
  w.once("tauri://error", (e) => {
    console.error("[widget-window] create error", e);
  });
}

/** 切り離し窓を閉じる(無ければ何もしない)。 */
export async function closeWidgetWindow(widgetId: string): Promise<void> {
  const w = await WebviewWindow.getByLabel(widgetLabel(widgetId));
  await w?.close();
}

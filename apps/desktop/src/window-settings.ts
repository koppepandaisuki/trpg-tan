import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "./storage";

/**
 * ウィンドウ表示設定(フルスクリーン)。設定は localStorage に保存し、
 * 起動時・トグル時に Tauri のウィンドウへ反映する。切り離しウィジェット窓
 * (?widget=)は対象外(メインウィンドウのみ)。
 */

const FULLSCREEN_KEY = "trpg.window.fullscreen.v1";

const listeners = new Set<(on: boolean) => void>();

export function getFullscreenPref(): boolean {
  return localStorage.getItem(FULLSCREEN_KEY) === "1";
}

function save(on: boolean) {
  try {
    localStorage.setItem(FULLSCREEN_KEY, on ? "1" : "0");
  } catch {
    // 保存失敗は致命ではない
  }
  listeners.forEach((cb) => cb(on));
}

/** 実ウィンドウへ反映(tauri 以外・ウィジェット窓では no-op)。 */
async function applyToWindow(on: boolean): Promise<void> {
  if (!isTauri()) return;
  const isWidget = new URLSearchParams(window.location.search).has("widget");
  if (isWidget) return;
  try {
    await getCurrentWindow().setFullscreen(on);
  } catch {
    // 権限/環境により失敗しても致命ではない
  }
}

/** フルスクリーンを設定(保存 + 反映)。 */
export async function setFullscreen(on: boolean): Promise<void> {
  save(on);
  await applyToWindow(on);
}

/** 現在の設定を反転。戻り値は新しい状態。 */
export async function toggleFullscreen(): Promise<boolean> {
  const next = !getFullscreenPref();
  await setFullscreen(next);
  return next;
}

/** 起動時に保存済み設定を反映する(App マウント時に 1 度呼ぶ)。 */
export async function applyFullscreenOnLaunch(): Promise<void> {
  if (getFullscreenPref()) await applyToWindow(true);
}

/** 設定変更の購読(Settings とヘッダの表示同期用)。 */
export function subscribeFullscreen(cb: (on: boolean) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

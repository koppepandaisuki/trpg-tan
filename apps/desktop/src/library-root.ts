import { appLocalDataDir, join } from "@tauri-apps/api/path";
import { mkdir, exists } from "@tauri-apps/plugin-fs";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

/**
 * 「ライブラリの場所」を一元管理する。
 *
 * ストア DL / .paradice 取り込み / .play (卓) / .ccsheet (キャラシ) の
 * 保存・取り込み先デフォルトをすべて 1 つのルート配下にまとめる。
 * Steam の「ストレージ」設定と同じ発想 — ユーザーが場所を選び替えても
 * 全部その下に集約される。
 *
 *   <root>/
 *     downloads/   ← 購入物の生ファイル(.paradice 等)
 *     packs/       ← 取り込み済みパッケージの展開先(.play, .ccsheet)
 *     sessions/    ← 卓 (.play) の Save As ダイアログの既定パス
 *     characters/  ← キャラシ (.ccsheet) の Save As ダイアログの既定パス
 *
 * 既定の root は `appLocalDataDir() / "library"`(Windows: %APPDATA% 配下)。
 * 設定画面でユーザーが任意フォルダに切り替え可能(localStorage で永続)。
 * 既存ファイルは移動しない(将来の Phase で「移動」ボタンを追加可能)。
 */

const KEY = "trpg.library.root.v1";
const DEFAULT_SUB = "library";

/** localStorage に保存された明示的なライブラリパス(無ければ null)。 */
function getStored(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** 既定の root（appLocalData/library）。 */
async function defaultRoot(): Promise<string> {
  return await join(await appLocalDataDir(), DEFAULT_SUB);
}

/**
 * ライブラリ root の絶対パスを返す。未設定 or 設定値が空なら既定。
 * 戻り値のフォルダは存在を保証する(無ければ作る)。
 */
export async function getLibraryRoot(): Promise<string> {
  const stored = getStored();
  const root = stored && stored.trim().length > 0 ? stored : await defaultRoot();
  await ensureDir(root);
  return root;
}

/** ユーザー設定の root を保存(直接 localStorage を触らない外部 API)。 */
export function setLibraryRoot(path: string): void {
  try {
    window.localStorage.setItem(KEY, path);
  } catch {
    // 失敗しても致命的ではない。次回も既定に戻るだけ。
  }
}

/** 既定に戻す。 */
export function resetLibraryRoot(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** ユーザーに root を選んでもらう(キャンセルは null)。 */
export async function pickLibraryRoot(): Promise<string | null> {
  const picked = await openDialog({ directory: true, multiple: false });
  if (!picked || typeof picked !== "string") return null;
  setLibraryRoot(picked);
  await ensureDir(picked);
  return picked;
}

/** root 配下のサブフォルダ(存在を保証)。 */
async function subDir(name: string): Promise<string> {
  const p = await join(await getLibraryRoot(), name);
  await ensureDir(p);
  return p;
}

export const getDownloadsDir = (): Promise<string> => subDir("downloads");
export const getPacksDir = (): Promise<string> => subDir("packs");
export const getSessionsDir = (): Promise<string> => subDir("sessions");
export const getCharactersDir = (): Promise<string> => subDir("characters");

async function ensureDir(path: string): Promise<void> {
  if (!(await exists(path))) {
    await mkdir(path, { recursive: true });
  }
}

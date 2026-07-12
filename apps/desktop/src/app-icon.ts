// アプリ(ウィンドウ/タスクバー)アイコンの切替。設定 > 画面・テーマ から選ぶ。
// exe・デスクトップショートカットのアイコンはビルド時に焼き込まれるため、
// ここで変わるのは実行中のウィンドウとタスクバーの表示のみ。
import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "./storage";

export type AppIconKind = "main" | "black" | "red";

const KEY = "redice.appIcon";

export const APP_ICONS: { kind: AppIconKind; label: string; src: string }[] = [
  { kind: "red", label: "レッド（既定）", src: "./icons/app-icon-red.png" },
  { kind: "main", label: "クリア", src: "./icons/app-icon-main.png" },
  { kind: "black", label: "ブラック", src: "./icons/app-icon-black.png" },
];

export function getAppIcon(): AppIconKind {
  const v = localStorage.getItem(KEY);
  return v === "main" || v === "black" || v === "red" ? v : "red";
}

export async function setAppIcon(kind: AppIconKind): Promise<void> {
  localStorage.setItem(KEY, kind);
  if (!isTauri()) return;
  try {
    await invoke("set_app_icon", { kind });
  } catch (e) {
    console.warn("[app-icon] 切替に失敗:", e);
  }
}

/** 起動時に保存済みの選択を適用する(既定 red はビルド既定と同じなので不要)。 */
export function applySavedAppIcon(): void {
  if (!isTauri()) return;
  const kind = getAppIcon();
  if (kind !== "red") {
    void invoke("set_app_icon", { kind }).catch(() => {});
  }
}

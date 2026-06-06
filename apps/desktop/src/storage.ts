import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { CCSHEET_SCHEMA_VERSION, type CharacterSheet } from "@trpg/core";

/**
 * .ccsheet(1 キャラ = 1 JSON ファイル)のローカル保存/読込。
 * Tauri ランタイム上でのみ動作する(ブラウザの vite dev では未対応)。
 */

/** Tauri ランタイム上で動いているか(ブラウザ dev と区別)*/
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

const FILTERS = [{ name: "TRPG Character", extensions: ["ccsheet"] }];

/** 保存ダイアログを出して .ccsheet を書き出す。返り値は保存先パス(キャンセルは null)。*/
export async function saveSheet(sheet: CharacterSheet): Promise<string | null> {
  const path = await save({
    defaultPath: `${sanitize(sheet.name) || "character"}.ccsheet`,
    filters: FILTERS,
  });
  if (!path) return null;
  await writeTextFile(path, JSON.stringify(sheet, null, 2));
  return path;
}

/** 読込ダイアログを出して .ccsheet を読む。返り値は {sheet, path}(キャンセルは null)。*/
export async function loadSheetViaDialog(): Promise<{
  sheet: CharacterSheet;
  path: string;
} | null> {
  const selected = await open({ multiple: false, filters: FILTERS });
  if (!selected || typeof selected !== "string") return null;
  return { sheet: await readSheetFromPath(selected), path: selected };
}

/** 既知のパスから .ccsheet を読む(ライブラリのカードから開くとき)。*/
export async function readSheetFromPath(
  path: string,
): Promise<CharacterSheet> {
  const text = await readTextFile(path);
  const parsed = JSON.parse(text) as CharacterSheet;
  if (parsed.schemaVersion !== CCSHEET_SCHEMA_VERSION) {
    throw new Error(`未対応の .ccsheet バージョンです(${parsed.schemaVersion})`);
  }
  return parsed;
}

function sanitize(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim();
}

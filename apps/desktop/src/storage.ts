import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import {
  CCSHEET_SCHEMA_VERSION,
  type CharacterSheet,
  type GenericSheet,
} from "@trpg/core";
import { getCharactersDir } from "./library-root";

/** .ccsheet に入りうるシート(CoC 専用 or カスタムシステムの汎用)。 */
export type AnySheet = CharacterSheet | GenericSheet;

export function isGenericSheet(sheet: AnySheet): sheet is GenericSheet {
  return "kind" in sheet && sheet.kind === "generic";
}

/**
 * .ccsheet(1 キャラ = 1 JSON ファイル)のローカル保存/読込。
 * Tauri ランタイム上でのみ動作する(ブラウザの vite dev では未対応)。
 */

/** Tauri ランタイム上で動いているか(ブラウザ dev と区別)*/
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

const FILTERS = [{ name: "TRPG Character", extensions: ["ccsheet"] }];

/** Save As の既定パスをライブラリ root / characters / に組み立てる。 */
async function defaultCharacterPath(name: string): Promise<string> {
  return join(
    await getCharactersDir(),
    `${sanitize(name) || "character"}.ccsheet`,
  );
}

/** 保存ダイアログを出して .ccsheet を書き出す。返り値は保存先パス(キャンセルは null)。*/
export async function saveSheet(sheet: CharacterSheet): Promise<string | null> {
  const path = await save({
    defaultPath: await defaultCharacterPath(sheet.name),
    filters: FILTERS,
  });
  if (!path) return null;
  await writeTextFile(path, JSON.stringify(sheet, null, 2));
  return path;
}

/** 読込ダイアログを出して .ccsheet を読む(CoC エディタ用。汎用シートは拒否)。*/
export async function loadSheetViaDialog(): Promise<{
  sheet: CharacterSheet;
  path: string;
} | null> {
  const selected = await open({ multiple: false, filters: FILTERS });
  if (!selected || typeof selected !== "string") return null;
  const sheet = await readSheetFromPath(selected);
  if (isGenericSheet(sheet)) {
    throw new Error(
      "カスタムシステムのキャラです。キャラクターページの一覧から開いてください",
    );
  }
  return { sheet, path: selected };
}

/** 既知のパスから .ccsheet を読む(CoC / 汎用どちらも)。*/
export async function readSheetFromPath(path: string): Promise<AnySheet> {
  const text = await readTextFile(path);
  const parsed = JSON.parse(text) as AnySheet;
  if (parsed.schemaVersion !== CCSHEET_SCHEMA_VERSION) {
    throw new Error(`未対応の .ccsheet バージョンです(${parsed.schemaVersion})`);
  }
  return parsed;
}

/** 汎用シート(カスタムシステム)を .ccsheet として書き出す。*/
export async function saveGenericSheet(
  sheet: GenericSheet,
): Promise<string | null> {
  const path = await save({
    defaultPath: await defaultCharacterPath(sheet.name),
    filters: FILTERS,
  });
  if (!path) return null;
  await writeTextFile(path, JSON.stringify(sheet, null, 2));
  return path;
}

function sanitize(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim();
}

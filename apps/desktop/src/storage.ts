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
 * .ccsheet(1 キャラ = 1 JSON)のローカル保存/読込。
 *  - Tauri: ファイルシステム(保存ダイアログ + ライブラリ root)
 *  - ブラウザ(PWA): localStorage の仮想パス `browser://sheet/<uuid>`
 * 呼び出し側は path を不透明な文字列として扱えばよく、環境差はここで吸収する。
 */

/** Tauri ランタイム上で動いているか(ブラウザ dev / PWA と区別)*/
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/* ===== ブラウザ(PWA)用: localStorage 保存 ===== */

const BROWSER_SHEET_PREFIX = "browser://sheet/";
const browserSheetKey = (path: string) =>
  `trpg.sheet.v1.${path.slice(BROWSER_SHEET_PREFIX.length)}`;

/** localStorage 保存の仮想パスか。 */
export function isBrowserSheetPath(path: string): boolean {
  return path.startsWith(BROWSER_SHEET_PREFIX);
}

function browserWriteSheet(path: string, sheet: AnySheet): void {
  try {
    localStorage.setItem(browserSheetKey(path), JSON.stringify(sheet));
  } catch (e) {
    // ほぼ容量超過(ポートレート画像が大きい)。原因がわかる文言で投げ直す。
    throw new Error(
      `この端末の保存領域がいっぱいです。ポートレート画像を小さくするか、使わないキャラを削除してください(${String(e).slice(0, 80)})`,
    );
  }
}

/** ブラウザ保存のキャラを索引から外すとき、実体も消す(リーク防止)。 */
export function deleteBrowserSheet(path: string): void {
  if (!isBrowserSheetPath(path)) return;
  try {
    localStorage.removeItem(browserSheetKey(path));
  } catch {
    // 消せなくても致命ではない
  }
}

const FILTERS = [{ name: "TRPG Character", extensions: ["ccsheet"] }];

/** Save As の既定パスをライブラリ root / characters / に組み立てる。 */
async function defaultCharacterPath(name: string): Promise<string> {
  return join(
    await getCharactersDir(),
    `${sanitize(name) || "character"}.ccsheet`,
  );
}

/** 別名で保存。Tauri は保存ダイアログ、ブラウザは localStorage の新規パス。
 *  返り値は保存先パス(ダイアログのキャンセルは null)。*/
export async function saveSheet(sheet: CharacterSheet): Promise<string | null> {
  if (!isTauri()) {
    const path = `${BROWSER_SHEET_PREFIX}${crypto.randomUUID()}`;
    browserWriteSheet(path, sheet);
    return path;
  }
  const path = await save({
    defaultPath: await defaultCharacterPath(sheet.name),
    filters: FILTERS,
  });
  if (!path) return null;
  await writeTextFile(path, JSON.stringify(sheet, null, 2));
  return path;
}

/** 既存パスへ直接上書き保存(ダイアログを出さない)。CoC / 汎用どちらも書ける。*/
export async function saveSheetToPath(
  sheet: CharacterSheet | GenericSheet,
  path: string,
): Promise<string> {
  if (isBrowserSheetPath(path)) {
    browserWriteSheet(path, sheet);
    return path;
  }
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
  let text: string;
  if (isBrowserSheetPath(path)) {
    const stored = localStorage.getItem(browserSheetKey(path));
    if (!stored) throw new Error("この端末に保存データが見つかりません");
    text = stored;
  } else {
    text = await readTextFile(path);
  }
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
  if (!isTauri()) {
    const path = `${BROWSER_SHEET_PREFIX}${crypto.randomUUID()}`;
    browserWriteSheet(path, sheet);
    return path;
  }
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

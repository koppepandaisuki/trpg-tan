import type { CharacterSheet, GenericSheet } from "@trpg/core";

/**
 * キャラクター・ライブラリ(一覧管理)。
 *
 * 実体の .ccsheet ファイルはユーザーが選んだ任意の場所にある(所有・ポータブル)。
 * ここではその「索引」を localStorage に持ち、保存/読込したキャラをカード一覧
 * として再び開けるようにする(Tauri の WebView でも localStorage は永続する)。
 *
 * 索引はファイルへの参照(path)に過ぎないので、ライブラリから削除しても
 * 元ファイルは消えない。
 */

const KEY = "trpg.library.v1";

/**
 * localStorage(容量数MB)に載せるサムネ(ポートレートの dataURL)の上限。
 * ポートレート原寸をそのまま索引に入れると数枚で容量超過し、setItem が失敗
 * → 索引が一切保存されず、PLAY 等の別画面からキャラを開けなくなる。
 * これを超える画像はサムネを落とす(索引本体=パス/名前/版を死守する)。
 */
const MAX_THUMB_CHARS = 48 * 1024;

function fitThumb(image?: string | null): string | null {
  if (!image) return null;
  return image.length <= MAX_THUMB_CHARS ? image : null;
}

export interface LibraryEntry {
  id: string;
  name: string;
  systemId: string;
  /** カスタムシステムの表示名(CoC は未設定)。 */
  systemName?: string;
  /** .ccsheet の絶対パス(ここから再読込する)*/
  path: string;
  /** 一覧表示用の小さなサムネ(ポートレートの data URL、無ければ null)*/
  thumbnail: string | null;
  /** 最終保存/オープン時刻(ISO)。新しい順表示に使う */
  updatedAt: string;
}

export function getLibrary(): LibraryEntry[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as LibraryEntry[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function persist(list: LibraryEntry[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
    return;
  } catch {
    // 容量超過: サムネが嵩んで索引全体が保存できない。サムネは副次的なので
    // 全部落として、索引(パス/名前)だけは確実に残す(別画面から開けるように)。
  }
  try {
    const slim = list.map((e) => ({ ...e, thumbnail: null }));
    window.localStorage.setItem(KEY, JSON.stringify(slim));
  } catch {
    // それでも入らなければ諦める(索引は副次的なもの)。
  }
}

/** エントリを追加 or 更新(同一 id/path は置換)し、新しい順に並べて返す。*/
export function upsertEntry(
  list: LibraryEntry[],
  entry: LibraryEntry,
): LibraryEntry[] {
  const rest = list.filter((e) => e.id !== entry.id && e.path !== entry.path);
  const next = [entry, ...rest].sort((a, b) =>
    a.updatedAt < b.updatedAt ? 1 : -1,
  );
  persist(next);
  return next;
}

export function removeEntry(
  list: LibraryEntry[],
  id: string,
): LibraryEntry[] {
  const next = list.filter((e) => e.id !== id);
  persist(next);
  return next;
}

/** シート + 保存先パスから索引エントリを作る。*/
export function buildEntry(
  sheet: CharacterSheet,
  path: string,
): LibraryEntry {
  return {
    id: sheet.id,
    name: sheet.name || "(名称未設定)",
    systemId: sheet.systemId,
    path,
    thumbnail: fitThumb(sheet.image),
    updatedAt: new Date().toISOString(),
  };
}

/** 汎用シート(カスタムシステム)用の索引エントリ。*/
export function buildGenericEntry(
  sheet: GenericSheet,
  path: string,
): LibraryEntry {
  return {
    id: sheet.id,
    name: sheet.name || "(名称未設定)",
    systemId: sheet.systemId,
    systemName: sheet.systemName,
    path,
    thumbnail: fitThumb(sheet.image),
    updatedAt: new Date().toISOString(),
  };
}

/** 一覧カードのシステム表記。*/
export function systemLabel(e: LibraryEntry): string {
  if (e.systemId === "coc6") return "CoC 6版";
  if (e.systemId === "coc7") return "CoC 7版";
  return e.systemName ?? "カスタム";
}

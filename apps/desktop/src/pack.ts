import { appLocalDataDir, join } from "@tauri-apps/api/path";
import { mkdir, writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { save, open } from "@tauri-apps/plugin-dialog";
import {
  parsePack,
  serializePack,
  collectPackMediaUrls,
  type TrpgPack,
} from "@trpg/core";
import { upsertCustomSystem } from "./systems-store";
import { getPlayIndex, upsertPlayIndex } from "./play-storage";
import { getLibrary, upsertEntry, buildGenericEntry } from "./library";

/**
 * 配布パッケージ(.paradice)の取り込み / 書き出し。
 *
 * 取り込みは「セットアップ不要」が目的: parsePack で厳格検証 → メディア参照を
 * 自分の Storage ドメインに限定 → システム(localStorage) / シナリオ(.play) /
 * シート(.ccsheet) をローカルに展開して索引へ登録するだけで、すぐ遊べる状態にする。
 */

const PACK_FILTERS = [{ name: "TRPG Pack", extensions: ["paradice"] }];

function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80) || "item";
}

/** メディア URL が自分の Storage(Supabase)に属するか。env 未設定ならスキップ。 */
function mediaHostOk(urls: string[]): { ok: boolean; bad?: string } {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!base) return { ok: true };
  let host: string;
  try {
    host = new URL(base).host;
  } catch {
    return { ok: true };
  }
  for (const u of urls) {
    try {
      if (new URL(u).host !== host) return { ok: false, bad: u };
    } catch {
      return { ok: false, bad: u };
    }
  }
  return { ok: true };
}

export interface ImportResult {
  name: string;
  system: boolean;
  scenarios: number;
  sheets: number;
}

/**
 * 検証済みパッケージをローカルへ展開する。
 *   - system   → カスタムシステムとして保存(localStorage)
 *   - scenarios→ appLocalData/packs/<id>/*.play + 卓索引
 *   - sheets   → appLocalData/packs/<id>/*.ccsheet + キャラ索引
 */
export async function importPack(pack: TrpgPack): Promise<ImportResult> {
  // セキュリティ: 外部の任意 URL を参照していたら弾く(自分の Storage のみ許可)。
  const host = mediaHostOk(collectPackMediaUrls(pack));
  if (!host.ok) {
    throw new Error(`許可されていないメディア参照が含まれています:\n${host.bad}`);
  }

  let scenarios = 0;
  let sheets = 0;

  if (pack.system) upsertCustomSystem(pack.system);

  const dir = await join(await appLocalDataDir(), "packs", safeName(pack.id));
  if (pack.scenarios?.length || pack.sheets?.length) {
    await mkdir(dir, { recursive: true });
  }

  let playIndex = getPlayIndex();
  for (const scene of pack.scenarios ?? []) {
    const path = await join(dir, `${safeName(scene.id)}.play`);
    await writeTextFile(path, JSON.stringify(scene, null, 2));
    playIndex = upsertPlayIndex(playIndex, {
      id: scene.id,
      title: scene.title,
      systemId: scene.systemId,
      path,
      panelCount: scene.panels?.length ?? 0,
      updatedAt: new Date().toISOString(),
    });
    scenarios += 1;
  }

  let lib = getLibrary();
  for (const sheet of pack.sheets ?? []) {
    const path = await join(dir, `${safeName(sheet.id)}.ccsheet`);
    await writeTextFile(path, JSON.stringify(sheet, null, 2));
    lib = upsertEntry(lib, buildGenericEntry(sheet, path));
    sheets += 1;
  }

  return { name: pack.name, system: !!pack.system, scenarios, sheets };
}

/** .paradice ファイルを開いて取り込む(キャンセルは null)。 */
export async function importPackFromFile(): Promise<ImportResult | null> {
  const selected = await open({ multiple: false, filters: PACK_FILTERS });
  if (!selected || typeof selected !== "string") return null;
  const text = await readTextFile(selected);
  const r = parsePack(text);
  if (!r.ok) throw new Error(r.error);
  return importPack(r.pack);
}

/** パッケージを .paradice ファイルへ書き出す(キャンセルは null)。 */
export async function exportPackToFile(pack: TrpgPack): Promise<string | null> {
  const path = await save({
    defaultPath: `${safeName(pack.name)}.paradice`,
    filters: PACK_FILTERS,
  });
  if (!path) return null;
  await writeTextFile(path, serializePack(pack));
  return path;
}

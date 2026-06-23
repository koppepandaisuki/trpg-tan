import { join } from "@tauri-apps/api/path";
import { mkdir, writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { save, open } from "@tauri-apps/plugin-dialog";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import {
  parsePack,
  serializePack,
  collectPackMediaUrls,
  type TrpgPack,
} from "@trpg/core";
import { supabase } from "./supabase";
import { upsertCustomSystem } from "./systems-store";
import { getPlayIndex, upsertPlayIndex } from "./play-storage";
import { getLibrary, upsertEntry, buildGenericEntry } from "./library";
import { getPacksDir } from "./library-root";

const WEB_BASE = (
  import.meta.env.VITE_WEB_BASE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

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

  // ライブラリ root / packs / <id> に展開(設定でユーザーが root を
  // 変えていれば追従する)。
  const dir = await join(await getPacksDir(), safeName(pack.id));
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

/** 既知のパスの .paradice を取り込む(購入物の「開く」などから)。 */
export async function importPackFromPath(path: string): Promise<ImportResult> {
  const text = await readTextFile(path);
  const r = parsePack(text);
  if (!r.ok) throw new Error(r.error);
  return importPack(r.pack);
}

/** .paradice ファイルを開いて取り込む(キャンセルは null)。 */
export async function importPackFromFile(): Promise<ImportResult | null> {
  const selected = await open({ multiple: false, filters: PACK_FILTERS });
  if (!selected || typeof selected !== "string") return null;
  return importPackFromPath(selected);
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

export interface PublishResult {
  productId: string;
  slug: string;
}

/**
 * アプリ内出品。下書き(draft)の full_package 商品を作り、.paradice を Storage に
 * アップロードする。表紙(cover)を渡すと同時にアップロードして cover_path を
 * 確定する。公開(published)は作者がクリエイターページで確認のうえ行う。
 */
export async function publishPack(
  pack: TrpgPack,
  meta: { title: string; priceJpy: number; description?: string },
  cover?: { blob: Blob; contentType: string },
): Promise<PublishResult> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) throw new Error("ログインが必要です");

  // 1. 下書き商品を作成 + アップロード token 取得(Bearer。CORS 回避で tauri fetch)。
  //    表紙を出すなら coverContentType を渡し、covers 用 token も受け取る。
  const res = await tauriFetch(`${WEB_BASE}/api/creator/pack/publish`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: meta.title,
      priceJpy: meta.priceJpy,
      description: meta.description,
      systemLabel: pack.system?.name,
      coverContentType: cover?.contentType,
    }),
  });
  let info: {
    ok?: boolean;
    message?: string;
    productId?: string;
    slug?: string;
    path?: string;
    token?: string;
    coverPath?: string | null;
    coverToken?: string | null;
  };
  try {
    info = (await res.json()) as typeof info;
  } catch {
    throw new Error(`サーバ応答が不正です (${res.status})`);
  }
  if (!res.ok || !info.ok || !info.path || !info.token || !info.productId) {
    throw new Error(info.message ?? `出品に失敗しました (${res.status})`);
  }

  // 2. .paradice 本体を署名付き URL へアップロード。
  const blob = new Blob([serializePack(pack)], { type: "application/json" });
  const { error: upErr } = await supabase.storage
    .from("product-files")
    .uploadToSignedUrl(info.path, info.token, blob, {
      contentType: "application/json",
    });
  if (upErr) throw new Error(`アップロードに失敗しました: ${upErr.message}`);

  // 3. 表紙(任意)。失敗しても本体出品は成立済みなので throw せず警告に留める。
  if (cover && info.coverPath && info.coverToken) {
    const { error: covErr } = await supabase.storage
      .from("covers")
      .uploadToSignedUrl(info.coverPath, info.coverToken, cover.blob, {
        contentType: cover.contentType,
      });
    if (covErr) {
      console.warn("[publishPack] cover upload failed:", covErr.message);
    }
  }

  return { productId: info.productId, slug: info.slug ?? "" };
}

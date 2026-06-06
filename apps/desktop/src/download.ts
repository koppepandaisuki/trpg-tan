import { fetch } from "@tauri-apps/plugin-http";
import {
  writeFile,
  mkdir,
  exists,
  BaseDirectory,
} from "@tauri-apps/plugin-fs";
import { appLocalDataDir, join } from "@tauri-apps/api/path";
import { supabase } from "./supabase";

/**
 * 購入物のダウンロード。
 *
 * フロー:
 *   1. Web の DL API(/api/library/:id/download)に Bearer JWT で POST し、
 *      短命の署名URL(+拡張子)を得る。
 *   2. その署名URLからファイル本体を取得。
 *   3. appLocalData/library/<productId>.<ext> に保存。
 *
 * 2 つの HTTP は webview の fetch ではなく tauri-plugin-http(Rust 側)を
 * 使う。これにより CORS の影響を受けず、ローカル/本番どちらの Web API も
 * Supabase Storage の署名URLも問題なく叩ける。
 */

const WEB_BASE = (
  import.meta.env.VITE_WEB_BASE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

/** ローカル保存先のサブフォルダ(appLocalData 配下)。 */
const LIBRARY_DIR = "library";

async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("ログインが必要です");
  return token;
}

type SignedUrlResponse = {
  ok: boolean;
  url?: string;
  ext?: string;
  message?: string;
};

/** DL API を叩いて署名URLと拡張子を得る。 */
async function requestSignedUrl(
  productId: string,
): Promise<{ url: string; ext: string }> {
  const token = await getAccessToken();
  const res = await fetch(`${WEB_BASE}/api/library/${productId}/download`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  let body: SignedUrlResponse;
  try {
    body = (await res.json()) as SignedUrlResponse;
  } catch {
    throw new Error(`サーバ応答が不正です (${res.status})`);
  }

  if (!res.ok || !body.ok || !body.url) {
    throw new Error(
      body.message ?? `ダウンロードを開始できませんでした (${res.status})`,
    );
  }
  return { url: body.url, ext: (body.ext ?? "bin").toLowerCase() };
}

export type DownloadResult = {
  /** 保存した絶対パス。 */
  path: string;
  /** appLocalData からの相対パス(viewer 用)。 */
  relativePath: string;
  ext: string;
  bytes: number;
};

/** 署名URL→ファイル取得→ローカル保存。保存した絶対パス等を返す。 */
export async function downloadToLibrary(
  productId: string,
): Promise<DownloadResult> {
  const { url, ext } = await requestSignedUrl(productId);

  // ファイル本体を取得(Rust 側 fetch なので CORS 無関係)。
  const fileRes = await fetch(url, { method: "GET" });
  if (!fileRes.ok) {
    throw new Error(`ファイルの取得に失敗しました (${fileRes.status})`);
  }
  const buf = await fileRes.arrayBuffer();
  const data = new Uint8Array(buf);

  // appLocalData/library/ を用意。
  if (!(await exists(LIBRARY_DIR, { baseDir: BaseDirectory.AppLocalData }))) {
    await mkdir(LIBRARY_DIR, {
      baseDir: BaseDirectory.AppLocalData,
      recursive: true,
    });
  }

  const relativePath = `${LIBRARY_DIR}/${productId}.${ext}`;
  await writeFile(relativePath, data, {
    baseDir: BaseDirectory.AppLocalData,
  });

  // 絶対パス(opener で Explorer 表示する用)。
  const base = await appLocalDataDir();
  const path = await join(base, relativePath);

  return { path, relativePath, ext, bytes: data.byteLength };
}

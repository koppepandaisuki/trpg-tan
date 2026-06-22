import { fetch } from "@tauri-apps/plugin-http";
import { writeFile } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { supabase } from "./supabase";
import { getDownloadsDir, getLibraryRoot } from "./library-root";

/**
 * 購入物のダウンロード。
 *
 * フロー:
 *   1. Web の DL API(/api/library/:id/download)に Bearer JWT で POST し、
 *      短命の署名URL(+拡張子)を得る。
 *   2. その署名URLからファイル本体を取得。
 *   3. <library-root>/downloads/<productId>.<ext> に保存。
 *
 * <library-root> は設定で切替可能(library-root.ts)。デフォルトは
 * appLocalData/library。
 *
 * 2 つの HTTP は webview の fetch ではなく tauri-plugin-http(Rust 側)を
 * 使う。これにより CORS の影響を受けず、ローカル/本番どちらの Web API も
 * Supabase Storage の署名URLも問題なく叩ける。
 */

const WEB_BASE = (
  import.meta.env.VITE_WEB_BASE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

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
  /** ライブラリ root からの相対パス(viewer 用)。 */
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

  // ライブラリ root / downloads / を確保 → 絶対パスで書く(設定で root を
  // 切り替えても追従するため BaseDirectory 固定にはしない)。
  const dir = await getDownloadsDir();
  const path = await join(dir, `${productId}.${ext}`);
  await writeFile(path, data);

  const root = await getLibraryRoot();
  const relativePath = path.startsWith(root)
    ? path.slice(root.length).replace(/^[\\/]+/, "")
    : path;

  return { path, relativePath, ext, bytes: data.byteLength };
}

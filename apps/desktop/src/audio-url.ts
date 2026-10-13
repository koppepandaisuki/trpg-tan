import { readFile } from "@tauri-apps/plugin-fs";

/**
 * ローカル音声ファイルを読み、再生可能な blob URL を返す(パス単位でキャッシュ)。
 * Rust 側の設定不要。Viewer と同じく fs.readFile → Blob 方式。
 */

const cache = new Map<string, string>();

function mimeOf(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "wav":
      return "audio/wav";
    case "ogg":
      return "audio/ogg";
    case "m4a":
    case "mp4":
      return "audio/mp4";
    case "flac":
      return "audio/flac";
    case "aac":
      return "audio/aac";
    case "opus":
      return "audio/opus";
    default:
      return "audio/mpeg";
  }
}

export async function audioUrl(path: string): Promise<string> {
  // Web 版で作られた卓は音源を Storage の公開 URL で持つ(ブラウザにローカル
  // パスが無いため)。<audio> はそのまま鳴らせるので readFile を通さない。
  // これが無いと、web で作った卓をデスクトップで開いたとき音が出ない。
  if (/^https?:\/\//i.test(path)) return path;

  const hit = cache.get(path);
  if (hit) return hit;
  const bytes = await readFile(path);
  const url = URL.createObjectURL(
    new Blob([bytes as BlobPart], { type: mimeOf(path) }),
  );
  cache.set(path, url);
  return url;
}

/** Uint8Array → base64(大きいファイルでもスタック超過しないよう分割)。 */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

const dataCache = new Map<string, string>();

/**
 * ローカル音声ファイルを data URL(base64)で返す(パス単位でキャッシュ)。
 * blob URL はこの端末でしか使えないので、ネット配信(参加者の再生)にはこちらを使う。
 */
export async function audioDataUrl(path: string): Promise<string> {
  // 既に公開 URL(Web 版で作られた卓の音源)ならそのまま配信できる。
  if (/^https?:\/\//i.test(path)) return path;

  const hit = dataCache.get(path);
  if (hit) return hit;
  const bytes = await readFile(path);
  const url = `data:${mimeOf(path)};base64,${bytesToBase64(bytes as Uint8Array)}`;
  dataCache.set(path, url);
  return url;
}

/** ファイルパスから拡張子を除いた表示名。 */
export function baseName(path: string): string {
  const file = path.split(/[\\/]/).pop() ?? path;
  const dot = file.lastIndexOf(".");
  return dot > 0 ? file.slice(0, dot) : file;
}

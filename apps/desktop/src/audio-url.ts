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
  const hit = cache.get(path);
  if (hit) return hit;
  const bytes = await readFile(path);
  const url = URL.createObjectURL(
    new Blob([bytes as BlobPart], { type: mimeOf(path) }),
  );
  cache.set(path, url);
  return url;
}

/** ファイルパスから拡張子を除いた表示名。 */
export function baseName(path: string): string {
  const file = path.split(/[\\/]/).pop() ?? path;
  const dot = file.lastIndexOf(".");
  return dot > 0 ? file.slice(0, dot) : file;
}

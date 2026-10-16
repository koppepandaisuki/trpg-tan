import { supabase } from "./supabase";
import { appFetch, WEB_BASE } from "./platform";

/**
 * 卓の素材を R2 へ直接アップロードする(Web の /api/play/upload-url が署名付き URL を発行)。
 * Web 版 lib/play/media.ts の uploadToR2 と同じ流れ。R2 未設定・失敗時は null を返し、
 * 呼び出し側は従来どおり Supabase Storage に上げる。
 */
export async function uploadToR2(params: {
  bytes: Uint8Array;
  hash: string;
  ext: string;
  mime: string;
}): Promise<{ url: string; path: string } | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;
    const res = await appFetch(`${WEB_BASE}/api/play/upload-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        hash: params.hash,
        ext: params.ext,
        mime: params.mime,
        size: params.bytes.byteLength,
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      mode?: "r2" | "supabase";
      uploadUrl?: string;
      publicUrl?: string;
      path?: string;
    };
    if (body.mode !== "r2" || !body.uploadUrl || !body.publicUrl || !body.path) return null;
    const put = await appFetch(body.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": params.mime },
      body: new Blob([params.bytes as BlobPart], { type: params.mime }),
    });
    if (!put.ok) {
      console.warn("[media-upload] R2 PUT failed", put.status);
      return null;
    }
    return { url: body.publicUrl, path: body.path };
  } catch (e) {
    console.warn("[media-upload] R2 upload failed", e);
    return null;
  }
}

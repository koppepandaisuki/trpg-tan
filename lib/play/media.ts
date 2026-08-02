import { createClient } from "@/lib/supabase/client";

/**
 * PLAY のメディア(盤面背景・駒画像)を `play` バケット(migration 0022)へ
 * アップロードして公開 URL を返す。
 *
 * 卓データ(play_sessions.scene)にも Realtime の broadcast にも data URL を
 * 載せないための入口。scene には URL 文字列だけが入るので、卓は数十 KB に
 * 収まり、参加者への同期も速い。
 *
 * パスは `<user_id>/<sha256>.<ext>`(内容ハッシュ)。同じ画像を何度上げても
 * 1 つに集約され、RLS(自分のフォルダのみ書ける)も満たす。
 */

const MAX_BYTES = 20 * 1024 * 1024; // バケット上限 25MB に対して安全側

export async function uploadPlayImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("画像ファイルを選んでください");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("画像が大きすぎます(20MB まで)");
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインが必要です");

  const buf = await file.arrayBuffer();
  const hash = await sha256Hex(buf);
  const ext = extOf(file);
  const path = `${user.id}/${hash}.${ext}`;

  const { error } = await supabase.storage.from("play").upload(path, file, {
    contentType: file.type,
    upsert: true, // 同内容の再アップロードは上書き(冪等)
  });
  if (error) throw new Error(`画像のアップロードに失敗しました: ${error.message}`);

  return supabase.storage.from("play").getPublicUrl(path).data.publicUrl;
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function extOf(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{1,5}$/.test(fromName)) return fromName;
  const fromMime = file.type.split("/")[1]?.toLowerCase();
  return fromMime && /^[a-z0-9]{1,5}$/.test(fromMime) ? fromMime : "png";
}

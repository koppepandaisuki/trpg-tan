import { createClient } from "@/lib/supabase/client";
import { assetNameFromFile, registerAsset, type AssetKind } from "./assets";

/**
 * PLAY のメディア(盤面背景・駒画像・BGM/SE)を `play` バケット(migration 0022)
 * へアップロードして公開 URL を返す。
 *
 * 卓データ(play_sessions.scene)にも Realtime の broadcast にも data URL を
 * 載せないための入口。scene には URL 文字列だけが入るので、卓は数十 KB に
 * 収まり、参加者への同期も速い。音声は特にこれが効く(数 MB を broadcast の
 * チャンクに割って流すと参加者側が数十秒待たされる)。
 *
 * パスは `<user_id>/<sha256>.<ext>`(内容ハッシュ)。同じファイルを何度上げても
 * 1 つに集約され、RLS(自分のフォルダのみ書ける)も満たす。
 *
 * アップロードしたものは play_assets(0049)にも登録し、ライブラリの「素材」に
 * 並ぶ。卓で使った背景・BGM を、次の卓でライブラリから選び直せるようにするため。
 */

const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // バケット上限 25MB に対して安全側
const MAX_AUDIO_BYTES = 24 * 1024 * 1024;

/** 盤面背景・駒画像。 */
export async function uploadPlayImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("画像ファイルを選んでください");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("画像が大きすぎます(20MB まで)");
  }
  return upload(file, "image", "画像");
}

/** BGM / 効果音。 */
export async function uploadPlayAudio(file: File): Promise<string> {
  if (!file.type.startsWith("audio/")) {
    throw new Error("音声ファイルを選んでください");
  }
  if (file.size > MAX_AUDIO_BYTES) {
    throw new Error("音声が大きすぎます(24MB まで)");
  }
  return upload(file, "audio", "音声");
}

async function upload(
  file: File,
  kind: AssetKind,
  label: string,
): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインが必要です");

  const buf = await file.arrayBuffer();
  const hash = await sha256Hex(buf);
  const path = `${user.id}/${hash}.${extOf(file)}`;

  const { error } = await supabase.storage.from("play").upload(path, file, {
    contentType: file.type,
    // upsert は使わない。パスが内容ハッシュなので同じパス = 同じ中身であり、
    // 上書きする意味が無い。加えて upsert:true は Storage を「既存行を読んで
    // 更新する」経路に入れるが、play バケットには SELECT ポリシーが無い
    // (0022: public バケットなので CDN 読みには不要)ため RLS 違反になる。
    upsert: false,
  });
  // 同じ内容が既に上がっているのは正常(内容アドレス指定)。desktop の
  // play-media.ts と同じ扱いにする。
  if (error && !/exist|dupl|conflict|409/i.test(error.message)) {
    throw new Error(`${label}のアップロードに失敗しました: ${error.message}`);
  }

  const url = supabase.storage.from("play").getPublicUrl(path).data.publicUrl;

  // ライブラリへの登録は「おまけ」。失敗しても(0049 未適用など)卓の
  // 画像・音はもう使えるので、アップロード自体は成功として返す。
  await registerAsset({
    ownerId: user.id,
    kind,
    name: assetNameFromFile(file.name),
    path,
    url,
    sizeBytes: file.size,
    mime: file.type,
  }).catch((e) => console.warn("[play-media] ライブラリ登録に失敗:", e));

  return url;
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
  return fromMime && /^[a-z0-9]{1,5}$/.test(fromMime) ? fromMime : "bin";
}

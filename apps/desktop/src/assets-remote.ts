import { supabase } from "./supabase";
import { extOfMime, sha256Hex } from "./play-media";

/**
 * ライブラリの「素材」(画像・音声)— Web と共有のクラウド保管庫。
 *
 * 実体は `play` バケットの `<uid>/<sha256>.<ext>`、索引は play_assets
 * (migration 0049)。Web 版の lib/play/assets.ts と同じテーブルを読み書きする
 * ので、どちらで追加した素材も両方のライブラリに並ぶ。
 *
 * 卓の共有時に裏で行う自動アップロード(play-media.ts の sanitizeForNet)は
 * ここに登録しない — 卓で使った立ち絵などが勝手に一覧を埋めないように、
 * 素材はユーザーが明示的に追加したものだけにする。
 */

const BUCKET = "play";
const MAX_BYTES = 24 * 1024 * 1024; // バケット上限 25MB に対して安全側

export type AssetKind = "image" | "audio";

export interface PlayAsset {
  id: string;
  kind: AssetKind;
  name: string;
  url: string;
  sizeBytes: number;
  createdAt: string;
}

type Row = {
  id: string;
  kind: AssetKind;
  name: string;
  url: string;
  size_bytes: number;
  created_at: string;
};

const COLUMNS = "id, kind, name, url, size_bytes, created_at";

function toAsset(r: Row): PlayAsset {
  return {
    id: r.id,
    kind: r.kind,
    name: r.name,
    url: r.url,
    sizeBytes: r.size_bytes,
    createdAt: r.created_at,
  };
}

/** 自分の素材を新しい順に(未ログインは空)。kind を渡すとその種類だけ。 */
export async function listMyAssets(kind?: AssetKind): Promise<PlayAsset[]> {
  let q = supabase
    .from("play_assets")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(500);
  if (kind) q = q.eq("kind", kind);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data as Row[]).map(toAsset);
}

/** ファイルを Storage に上げて素材として登録する。 */
export async function uploadAsset(file: File): Promise<void> {
  const kind: AssetKind | null = file.type.startsWith("image/")
    ? "image"
    : file.type.startsWith("audio/")
      ? "audio"
      : null;
  if (!kind) throw new Error(`「${file.name}」は画像でも音声でもありません`);
  if (file.size > MAX_BYTES) throw new Error(`「${file.name}」が大きすぎます(24MB まで)`);

  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("素材の保管にはログインが必要です");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const path = `${uid}/${await sha256Hex(bytes)}.${extOfMime(file.type)}`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  // 同じ内容が既にあるのは正常(内容アドレス指定)。upsert:true は play バケットに
  // SELECT ポリシーが無いため RLS 違反になる(Web 版で踏んだ罠)。
  if (upErr && !/exist|dupl|conflict|409/i.test(upErr.message)) {
    throw new Error(`アップロードに失敗しました: ${upErr.message}`);
  }
  const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  const name = (file.name.replace(/\.[^.]+$/, "").trim() || "無題").slice(0, 80);
  // 同じファイルは 1 行に集約。既にあれば名前を上書きしない(ユーザーの改名を守る)。
  const { error } = await supabase.from("play_assets").upsert(
    {
      owner_id: uid,
      kind,
      name,
      path,
      url,
      size_bytes: file.size,
      mime: file.type,
    },
    { onConflict: "owner_id,path", ignoreDuplicates: true },
  );
  if (error) throw new Error(error.message);
}

export async function renameAsset(id: string, name: string): Promise<void> {
  const trimmed = name.trim().slice(0, 80);
  if (!trimmed) throw new Error("名前を入れてください");
  const { error } = await supabase
    .from("play_assets")
    .update({ name: trimmed })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** ライブラリから外す(Storage の実体は残す = 卓で使用中の画像・音は切れない)。 */
export async function removeAsset(id: string): Promise<void> {
  const { error } = await supabase.from("play_assets").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

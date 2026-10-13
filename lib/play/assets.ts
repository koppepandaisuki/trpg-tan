import { createClient } from "@/lib/supabase/client";

/**
 * ライブラリの「素材」(画像・音声)— play_assets(migration 0049)。
 *
 * 実体は `play` バケットの `<owner_id>/<sha256>.<ext>`。このテーブルは
 * 人が読める名前を付けて一覧するための索引。卓でアップロードした素材も
 * lib/play/media.ts から自動でここに登録される。
 */

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

export function toAsset(r: Row): PlayAsset {
  return {
    id: r.id,
    kind: r.kind,
    name: r.name,
    url: r.url,
    sizeBytes: r.size_bytes,
    createdAt: r.created_at,
  };
}

export const ASSET_COLUMNS = "id, kind, name, url, size_bytes, created_at";

/** 表示名: ファイル名から拡張子を除き、DB の上限(80 文字)に収める。 */
export function assetNameFromFile(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").trim();
  return (base || "無題").slice(0, 80);
}

/**
 * アップロード済みファイルを索引に登録する。
 *
 * 同じファイル(= 同じ内容ハッシュ = 同じ path)は 1 行に集約する。既にあれば
 * 何もしない(ユーザーが付け直した名前を、再アップロードで上書きしないため)。
 */
export async function registerAsset(params: {
  ownerId: string;
  kind: AssetKind;
  name: string;
  path: string;
  url: string;
  sizeBytes: number;
  mime: string;
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("play_assets").upsert(
    {
      owner_id: params.ownerId,
      kind: params.kind,
      name: params.name,
      path: params.path,
      url: params.url,
      size_bytes: params.sizeBytes,
      mime: params.mime,
    },
    { onConflict: "owner_id,path", ignoreDuplicates: true },
  );
  if (error) throw new Error(error.message);
}

/** 自分の素材を新しい順に。kind を渡すとその種類だけ。 */
export async function listMyAssets(kind?: AssetKind): Promise<PlayAsset[]> {
  const supabase = createClient();
  let q = supabase
    .from("play_assets")
    .select(ASSET_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(500);
  if (kind) q = q.eq("kind", kind);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data as Row[]).map(toAsset);
}

export async function renameAsset(id: string, name: string): Promise<void> {
  const trimmed = name.trim().slice(0, 80);
  if (!trimmed) throw new Error("名前を入れてください");
  const supabase = createClient();
  const { error } = await supabase
    .from("play_assets")
    .update({ name: trimmed })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * ライブラリから外す。Storage の実体は消さない — 卓の scene がこの URL を
 * 参照していることがあり、消すとその卓の画像・音が切れてしまうため。
 */
export async function removeAsset(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("play_assets").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

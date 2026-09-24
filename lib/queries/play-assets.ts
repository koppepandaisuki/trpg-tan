import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ASSET_COLUMNS, toAsset, type PlayAsset } from "@/lib/play/assets";

/**
 * ライブラリの素材一覧(play_assets / migration 0049)の初期表示用。
 *
 * 0049 が未適用でもライブラリ自体は開けるよう、失敗時は空配列 + ok:false を
 * 返して呼び出し側に「素材は準備中」を出させる(卓の一覧は巻き込まない)。
 */
export async function listMyPlayAssets(
  userId: string,
): Promise<{ ok: boolean; assets: PlayAsset[] }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("play_assets")
    .select(ASSET_COLUMNS)
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    console.warn("[play-assets] list failed:", error.message);
    return { ok: false, assets: [] };
  }
  return { ok: true, assets: (data ?? []).map(toAsset) };
}

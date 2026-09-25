import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  SUMMARY_COLUMNS,
  toSummary,
  type SheetQuota,
  type SheetSummary,
} from "@/lib/sheets/client";

/**
 * キャラシ一覧(character_sheets / migration 0050)の初期表示用。
 * 0050 が未適用でも画面は開けるよう、失敗時は ok:false で空を返す
 * (エディタ自体はログインなし・保存なしでも使える)。
 */
export async function listMyCharacterSheets(
  userId: string,
): Promise<{ ok: boolean; sheets: SheetSummary[]; quota: SheetQuota | null }> {
  const supabase = createClient();
  const [list, quota] = await Promise.all([
    supabase
      .from("character_sheets")
      .select(SUMMARY_COLUMNS)
      .eq("owner_id", userId)
      .order("updated_at", { ascending: false })
      .limit(500),
    supabase.rpc("my_character_sheet_quota"),
  ]);
  if (list.error) {
    console.warn("[character-sheets] list failed:", list.error.message);
    return { ok: false, sheets: [], quota: null };
  }
  const q = Array.isArray(quota.data) ? quota.data[0] : quota.data;
  return {
    ok: true,
    sheets: (list.data ?? []).map(toSummary),
    quota: q ? { used: q.used ?? 0, limit: q.sheet_limit ?? null } : null,
  };
}

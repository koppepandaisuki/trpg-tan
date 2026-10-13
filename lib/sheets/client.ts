import { createClient } from "@/lib/supabase/client";
import type { AnySheet } from "@trpg/ui/io";
import { isGenericSheet } from "@trpg/ui/io";

/**
 * Web 版キャラシのクラウド保存(character_sheets / migration 0050)。ブラウザ側。
 *
 * 保存数の上限は DB のトリガで強制している(無料・play は上限あり、Pro は無制限)。
 * 上限に当たると RPC エラー "sheet_limit_reached" になるので、利用者向けの文言に
 * 置き換えて投げる。
 */

export interface SheetSummary {
  id: string;
  kind: "coc" | "generic";
  systemId: string;
  systemName: string | null;
  name: string;
  thumbnail: string | null;
  updatedAt: string;
}

export interface SheetQuota {
  used: number;
  /** null = 無制限(Pro / 管理者)。 */
  limit: number | null;
}

type SummaryRow = {
  id: string;
  kind: "coc" | "generic";
  system_id: string;
  system_name: string | null;
  name: string;
  thumbnail: string | null;
  updated_at: string;
};

export const SUMMARY_COLUMNS =
  "id, kind, system_id, system_name, name, thumbnail, updated_at";

export function toSummary(r: SummaryRow): SheetSummary {
  return {
    id: r.id,
    kind: r.kind,
    systemId: r.system_id,
    systemName: r.system_name,
    name: r.name,
    thumbnail: r.thumbnail,
    updatedAt: r.updated_at,
  };
}

/** 一覧に持ち上げる列(data 本体とは別に、名前・システム・サムネ)。 */
function metaOf(sheet: AnySheet) {
  const generic = isGenericSheet(sheet);
  return {
    kind: generic ? ("generic" as const) : ("coc" as const),
    system_id: sheet.systemId ?? "",
    system_name: generic
      ? sheet.systemName
      : sheet.systemId === "coc6"
        ? "クトゥルフ神話TRPG(第6版)"
        : "クトゥルフ神話TRPG(第7版)",
    name: (sheet.name ?? "").slice(0, 80),
  };
}

function friendly(e: { message?: string } | null): Error {
  const m = e?.message ?? "";
  if (m.includes("sheet_limit_reached")) {
    return new Error(
      "保存できるキャラの上限に達しました。不要なキャラを削除するか、Pro プランで無制限にできます。",
    );
  }
  if (m.includes("JWT") || m.includes("not authenticated")) {
    return new Error("ログインが必要です");
  }
  return new Error(m || "保存に失敗しました");
}

async function requireUserId(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("保存するにはログインが必要です");
  return user.id;
}

export async function listMySheets(): Promise<SheetSummary[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("character_sheets")
    .select(SUMMARY_COLUMNS)
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) throw friendly(error);
  return (data as SummaryRow[]).map(toSummary);
}

export async function getSheet(id: string): Promise<AnySheet> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("character_sheets")
    .select("data")
    .eq("id", id)
    .maybeSingle();
  if (error) throw friendly(error);
  if (!data) throw new Error("キャラが見つかりません(削除された可能性があります)");
  return data.data as AnySheet;
}

/** 新規保存。thumbnail が undefined なら列に触れない。戻り値は行 id。 */
export async function insertSheet(
  sheet: AnySheet,
  thumbnail: string | null | undefined,
): Promise<string> {
  const ownerId = await requireUserId();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("character_sheets")
    .insert({
      owner_id: ownerId,
      ...metaOf(sheet),
      ...(thumbnail !== undefined ? { thumbnail } : {}),
      data: sheet,
    })
    .select("id")
    .single();
  if (error) throw friendly(error);
  return data.id as string;
}

export async function updateSheet(
  id: string,
  sheet: AnySheet,
  thumbnail: string | null | undefined,
): Promise<void> {
  await requireUserId();
  const supabase = createClient();
  const { error } = await supabase
    .from("character_sheets")
    .update({
      ...metaOf(sheet),
      ...(thumbnail !== undefined ? { thumbnail } : {}),
      data: sheet,
    })
    .eq("id", id);
  if (error) throw friendly(error);
}

export async function deleteSheet(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("character_sheets").delete().eq("id", id);
  if (error) throw friendly(error);
}

export async function getQuota(): Promise<SheetQuota | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("my_character_sheet_quota");
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return { used: row.used ?? 0, limit: row.sheet_limit ?? null };
}

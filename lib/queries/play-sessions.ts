import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PlayScene } from "@trpg/core";

/**
 * Web 版 PLAY の卓(play_sessions / migration 0048)の読み取り。
 *
 * ロビー一覧は巨大な `scene` を読まずに済むよう、カード表示に必要な列だけを
 * 引く(scene は卓を開くときにだけ取得する)。RLS で所有者のみ読めるため、
 * 呼び出し側での owner 絞り込みは不要だが、意図を明示するため eq も付ける。
 */

/** ロビーのカード 1 枚分(scene を含まない軽量版)。 */
export interface PlaySessionSummary {
  id: string;
  title: string;
  systemId: string;
  systemLabel: string | null;
  tags: string[];
  thumbnail: string | null;
  panelCount: number;
  updatedAt: string;
}

const SUMMARY_COLUMNS =
  "id, title, system_id, system_label, tags, thumbnail, panel_count, updated_at";

type SummaryRow = {
  id: string;
  title: string;
  system_id: string;
  system_label: string | null;
  tags: string[] | null;
  thumbnail: string | null;
  panel_count: number;
  updated_at: string;
};

function toSummary(r: SummaryRow): PlaySessionSummary {
  return {
    id: r.id,
    title: r.title,
    systemId: r.system_id,
    systemLabel: r.system_label,
    tags: r.tags ?? [],
    thumbnail: r.thumbnail,
    panelCount: r.panel_count,
    updatedAt: r.updated_at,
  };
}

/** 自分の卓を更新順に。失敗時は空配列(ロビーは空表示で成立する)。 */
export async function listMyPlaySessions(
  userId: string,
): Promise<PlaySessionSummary[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("play_sessions")
    .select(SUMMARY_COLUMNS)
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error || !data) {
    if (error) console.error("[listMyPlaySessions] failed", error);
    return [];
  }
  return (data as SummaryRow[]).map(toSummary);
}

/** 卓の実体(PlayScene)。存在しない / 他人の卓なら null。 */
export async function getMyPlayScene(
  userId: string,
  id: string,
): Promise<PlayScene | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("play_sessions")
    .select("scene")
    .eq("owner_id", userId)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("[getMyPlayScene] failed", error);
    return null;
  }
  return (data as { scene: PlayScene }).scene;
}

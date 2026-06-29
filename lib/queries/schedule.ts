import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ScheduleEventPublic,
  ScheduleEventSummary,
  ScheduleSlot,
  ScheduleVote,
  ScheduleComment,
  ScenarioRef,
  ScheduleMode,
  VoteState,
} from "@/lib/schedule/types";

/**
 * 日程調整の読み取り(全て admin/service_role 経由。RLS は全面ロックなので
 * 通常クライアントからは触れない)。トークン検証は呼び出し側(route handler /
 * server component)が行い、ここは「トークンに対応するイベント」を解決するだけ。
 * admin_token は返り値に含めない。
 */

interface EventRow {
  id: string;
  public_token: string;
  admin_token: string;
  title: string;
  memo: string;
  mode: string;
  deadline: string | null;
  scenario_ref: ScenarioRef | null;
  owner_user_id: string | null;
  finalized_slot_id: string | null;
  created_at: string;
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function loadChildren(
  admin: AdminClient,
  eventId: string,
): Promise<{
  slots: ScheduleSlot[];
  votes: ScheduleVote[];
  comments: ScheduleComment[];
}> {
  const [slotsRes, votesRes, commentsRes] = await Promise.all([
    admin
      .from("schedule_slots")
      .select("id, starts_at, label, sort")
      .eq("event_id", eventId)
      .order("sort", { ascending: true })
      .order("starts_at", { ascending: true }),
    admin
      .from("schedule_votes")
      .select("slot_id, voter_key, voter_name, state, user_id")
      .eq("event_id", eventId),
    admin
      .from("schedule_comments")
      .select("id, name, text, created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true }),
  ]);

  const slots: ScheduleSlot[] = (slotsRes.data ?? []).map((r) => ({
    id: r.id as string,
    startsAt: r.starts_at as string,
    label: (r.label as string) ?? "",
    sort: (r.sort as number) ?? 0,
  }));
  const votes: ScheduleVote[] = (votesRes.data ?? []).map((r) => ({
    slotId: r.slot_id as string,
    voterKey: r.voter_key as string,
    voterName: r.voter_name as string,
    state: r.state as VoteState,
    userId: (r.user_id as string | null) ?? null,
  }));
  const comments: ScheduleComment[] = (commentsRes.data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    text: r.text as string,
    createdAt: r.created_at as string,
  }));
  return { slots, votes, comments };
}

function mapEventPublic(
  row: EventRow,
  slots: ScheduleSlot[],
  votes: ScheduleVote[],
  comments: ScheduleComment[],
): ScheduleEventPublic {
  return {
    id: row.id,
    publicToken: row.public_token,
    title: row.title,
    memo: row.memo,
    mode: (row.mode as ScheduleMode) ?? "list",
    deadline: row.deadline,
    scenarioRef: row.scenario_ref ?? null,
    finalizedSlotId: row.finalized_slot_id,
    createdAt: row.created_at,
    slots,
    votes,
    comments,
  };
}

async function fetchEventBy(
  column: "public_token" | "admin_token",
  token: string,
): Promise<ScheduleEventPublic | null> {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("schedule_events")
    .select("*")
    .eq(column, token)
    .maybeSingle();
  if (!row) return null;
  const { slots, votes, comments } = await loadChildren(admin, (row as EventRow).id);
  return mapEventPublic(row as EventRow, slots, votes, comments);
}

export function getEventByPublicToken(
  publicToken: string,
): Promise<ScheduleEventPublic | null> {
  return fetchEventBy("public_token", publicToken);
}

/** 管理トークンからイベントを解決(主催の管理画面用。形は public と同じ)。 */
export function getEventByAdminToken(
  adminToken: string,
): Promise<ScheduleEventPublic | null> {
  return fetchEventBy("admin_token", adminToken);
}

/** ログイン主催の「自分のイベント一覧」。slot 数・投票者数は JS 側で集計。 */
export async function listMyEvents(
  userId: string,
): Promise<ScheduleEventSummary[]> {
  const admin = createAdminClient();
  const { data: events } = await admin
    .from("schedule_events")
    .select(
      "id, public_token, title, mode, deadline, finalized_slot_id, created_at",
    )
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: false });
  if (!events || events.length === 0) return [];

  const ids = events.map((e) => e.id as string);
  const [slotsRes, votesRes] = await Promise.all([
    admin.from("schedule_slots").select("event_id").in("event_id", ids),
    admin.from("schedule_votes").select("event_id, voter_key").in("event_id", ids),
  ]);

  const slotCount = new Map<string, number>();
  for (const r of slotsRes.data ?? []) {
    const k = r.event_id as string;
    slotCount.set(k, (slotCount.get(k) ?? 0) + 1);
  }
  // 投票者数 = event 内のユニーク voter_key 数。
  const voters = new Map<string, Set<string>>();
  for (const r of votesRes.data ?? []) {
    const k = r.event_id as string;
    if (!voters.has(k)) voters.set(k, new Set());
    voters.get(k)!.add(r.voter_key as string);
  }

  return events.map((e) => ({
    id: e.id as string,
    publicToken: e.public_token as string,
    title: e.title as string,
    mode: (e.mode as ScheduleMode) ?? "list",
    deadline: (e.deadline as string | null) ?? null,
    finalizedSlotId: (e.finalized_slot_id as string | null) ?? null,
    slotCount: slotCount.get(e.id as string) ?? 0,
    voterCount: voters.get(e.id as string)?.size ?? 0,
    createdAt: e.created_at as string,
  }));
}

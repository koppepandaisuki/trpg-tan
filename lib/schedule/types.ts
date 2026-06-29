/**
 * 日程調整ツールの型(サーバ query が返し、UI が消費する形)。
 * DB 行そのものではなく camelCase に整形した「表示用」の形。
 * admin_token は公開ペイロードには絶対に含めない。
 */

export type VoteState = "yes" | "maybe" | "no";
export type ScheduleMode = "list" | "grid";

/** 任意のシナリオ参照(ストア商品 or 自由入力)。 */
export interface ScenarioRef {
  kind: "product" | "free";
  productId?: string;
  slug?: string;
  title: string;
  coverPath?: string | null;
}

export interface ScheduleSlot {
  id: string;
  /** ISO datetime。 */
  startsAt: string;
  label: string;
  sort: number;
}

export interface ScheduleVote {
  slotId: string;
  voterKey: string;
  voterName: string;
  state: VoteState;
  userId: string | null;
}

export interface ScheduleComment {
  id: string;
  name: string;
  text: string;
  createdAt: string;
}

/** 公開ペイロード(public_token から解決。admin_token は含めない)。 */
export interface ScheduleEventPublic {
  id: string;
  publicToken: string;
  title: string;
  memo: string;
  mode: ScheduleMode;
  deadline: string | null;
  scenarioRef: ScenarioRef | null;
  finalizedSlotId: string | null;
  createdAt: string;
  slots: ScheduleSlot[];
  votes: ScheduleVote[];
  comments: ScheduleComment[];
}

/** 主催の「自分のイベント一覧」用の軽量行。 */
export interface ScheduleEventSummary {
  id: string;
  publicToken: string;
  title: string;
  mode: ScheduleMode;
  deadline: string | null;
  finalizedSlotId: string | null;
  slotCount: number;
  voterCount: number;
  createdAt: string;
}

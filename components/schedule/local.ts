"use client";

/**
 * 日程調整のクライアント・ローカル状態(localStorage)。
 *   - voterKey: 1 人を束ねる安定キー(信頼ベース編集で自分の行を再編集するため)。
 *   - 表示名: PLAY 参加者名と同じキーを再利用(アプリ全体で名前を統一)。
 *   - 作成したイベント: 主催が管理用URL(admin_token)を後から開けるよう控える。
 */

const KEY_VOTER = "trpg.schedule.voterKey.v1";
const KEY_NAME = "trpg.net.name.v1";
const KEY_MINE = "trpg.schedule.mine.v1";

function rid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

/** このブラウザの投票者キー(無ければ生成して保存)。 */
export function getVoterKey(): string {
  if (typeof window === "undefined") return "";
  try {
    let k = window.localStorage.getItem(KEY_VOTER);
    if (!k) {
      k = rid();
      window.localStorage.setItem(KEY_VOTER, k);
    }
    return k;
  } catch {
    return rid();
  }
}

export function getRememberedName(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(KEY_NAME) ?? "";
  } catch {
    return "";
  }
}

export function rememberName(name: string): void {
  try {
    window.localStorage.setItem(KEY_NAME, name);
  } catch {
    // 容量等は無視(副次的)。
  }
}

export interface SavedEvent {
  id: string;
  publicToken: string;
  adminToken: string;
  title: string;
  savedAt: string;
}

export function getMyEvents(): SavedEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY_MINE);
    if (!raw) return [];
    const list = JSON.parse(raw) as SavedEvent[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveMyEvent(e: SavedEvent): void {
  try {
    const rest = getMyEvents().filter((x) => x.id !== e.id);
    const next = [e, ...rest].slice(0, 50);
    window.localStorage.setItem(KEY_MINE, JSON.stringify(next));
  } catch {
    // 副次的なので無視。
  }
}

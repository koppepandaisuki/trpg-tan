import { SYSTEM_PRESETS, sheetFromVampireBlood, type SystemDef } from "@trpg/core";
import type { SheetSources } from "@trpg/ui/io";

/**
 * Web 版キャラシで選べるシステムと、外部サイトからの取り込み。
 *
 * 自作システムはデスクトップ/アプリ(PWA)のビルダーが localStorage の
 * `trpg.systems.v1` に保存している。/app の PWA は Web と同じオリジンなので、
 * そこで作った自作システムはこのキーからそのまま読める(デスクトップ本体の
 * 自作システムはクラウド同期していないため Web には出ない)。
 */

const CUSTOM_SYSTEMS_KEY = "trpg.systems.v1";

function readCustomSystems(): SystemDef[] {
  try {
    const raw = window.localStorage.getItem(CUSTOM_SYSTEMS_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? (list as SystemDef[]) : [];
  } catch {
    return [];
  }
}

/** 自作 → プリセットの順(デスクトップの getAllSystems と同じ)。 */
export function getWebSystems(): SystemDef[] {
  return [...readCustomSystems(), ...SYSTEM_PRESETS];
}

export function findWebSystem(id: string): SystemDef | null {
  return getWebSystems().find((s) => s.id === id) ?? null;
}

export const webSheetSources: SheetSources = {
  getSystems: getWebSystems,
  async importVampireBlood(input) {
    const res = await fetch(
      `/api/sheets/vampire?input=${encodeURIComponent(input.trim())}`,
      { cache: "no-store" },
    );
    const body = (await res.json().catch(() => null)) as
      | { ok: true; sheet: Record<string, unknown> }
      | { ok: false; message?: string }
      | null;
    if (!res.ok || !body || !body.ok) {
      throw new Error(
        (body && !body.ok && body.message) || `取り込みに失敗しました (${res.status})`,
      );
    }
    return sheetFromVampireBlood(body.sheet, {
      id: crypto.randomUUID(),
      now: new Date().toISOString(),
    });
  },
};

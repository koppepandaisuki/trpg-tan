import { SYSTEM_PRESETS, type SystemDef } from "@trpg/core";

/**
 * カスタムシステム定義のローカル保存(localStorage)。
 * プリセット(@trpg/core)は読み取り専用で、編集するときは複製して
 * カスタムとして保存する。
 */

const KEY = "trpg.systems.v1";

export function getCustomSystems(): SystemDef[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as SystemDef[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function persist(list: SystemDef[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // 容量超過などは無視
  }
}

/** カスタム + プリセット(カスタムが先)。 */
export function getAllSystems(): SystemDef[] {
  return [...getCustomSystems(), ...SYSTEM_PRESETS];
}

export function findSystem(id: string): SystemDef | null {
  return getAllSystems().find((s) => s.id === id) ?? null;
}

export function upsertCustomSystem(def: SystemDef): SystemDef[] {
  const list = getCustomSystems();
  const next = [
    { ...def, preset: false },
    ...list.filter((s) => s.id !== def.id),
  ];
  persist(next);
  return next;
}

export function removeCustomSystem(id: string): SystemDef[] {
  const next = getCustomSystems().filter((s) => s.id !== id);
  persist(next);
  return next;
}

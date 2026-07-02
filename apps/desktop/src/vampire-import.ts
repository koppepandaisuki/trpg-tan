import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import {
  sheetFromVampireBlood,
  vampireBloodJsonUrl,
  type CharacterSheet,
} from "@trpg/core";

/**
 * キャラクター保管所の URL / ID からシートを取得して CharacterSheet に変換。
 * NewCharacterMenu とシステムピッカーの両方から使う共通ヘルパー。
 * CORS 回避のため tauri-plugin-http(Rust 側)で取得する。
 */
export async function importVampireBloodSheet(
  input: string,
): Promise<CharacterSheet> {
  const jsonUrl = vampireBloodJsonUrl(input);
  if (!jsonUrl) {
    throw new Error(
      "URL が正しくありません(例: https://charasheet.vampire-blood.net/12345)",
    );
  }
  const res = await tauriFetch(jsonUrl);
  if (!res.ok) throw new Error(`取得に失敗しました (${res.status})`);
  const json = (await res.json()) as Record<string, unknown>;
  return sheetFromVampireBlood(json, {
    id: crypto.randomUUID(),
    now: new Date().toISOString(),
  });
}

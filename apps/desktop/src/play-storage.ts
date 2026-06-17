import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { PLAY_SCHEMA_VERSION, type PlayScene } from "@trpg/core";

/**
 * セッション卓(.play = 1 セッション JSON)のローカル保存/読込と、索引。
 * .ccsheet と同じく「実体はユーザーの任意パス、索引は localStorage」。
 * GM のローカルが正(設計どおり)。
 */

const FILTERS = [{ name: "TRPG Play", extensions: ["play"] }];

export async function savePlayAs(scene: PlayScene): Promise<string | null> {
  const path = await save({
    defaultPath: `${sanitize(scene.title) || "session"}.play`,
    filters: FILTERS,
  });
  if (!path) return null;
  await writeTextFile(path, serialize(scene));
  return path;
}

export async function savePlayToPath(
  scene: PlayScene,
  path: string,
): Promise<void> {
  await writeTextFile(path, serialize(scene));
}

export async function loadPlayViaDialog(): Promise<{
  scene: PlayScene;
  path: string;
} | null> {
  const selected = await open({ multiple: false, filters: FILTERS });
  if (!selected || typeof selected !== "string") return null;
  return { scene: await readPlayFromPath(selected), path: selected };
}

export async function readPlayFromPath(path: string): Promise<PlayScene> {
  const text = await readTextFile(path);
  const parsed = JSON.parse(text) as PlayScene;
  if (parsed.schemaVersion !== PLAY_SCHEMA_VERSION) {
    throw new Error(`未対応の .play バージョンです(${parsed.schemaVersion})`);
  }
  return migrate(parsed);
}

/**
 * 旧 .play の前方互換。BGM/シーンが無い卓を開いても落ちないよう、
 * 既定値を補完する(スキーマ版は据え置き = 既存フィールドの追加のみ)。
 */
function migrate(scene: PlayScene): PlayScene {
  const board = scene.board ?? { image: null, grid: true };
  const bgm = scene.bgm ?? { tracks: [] };
  if (scene.scenes && scene.scenes.length > 0 && scene.activeSceneId) {
    return { ...scene, board, bgm };
  }
  // シーン未対応の卓: 現在の盤面を「シーン1」として 1 つ作る。
  const firstSceneId = `${scene.id}::s1`;
  return {
    ...scene,
    board,
    bgm,
    scenes: [{ id: firstSceneId, name: "シーン1", board }],
    activeSceneId: firstSceneId,
  };
}

function serialize(scene: PlayScene): string {
  return JSON.stringify(scene, null, 2);
}

function sanitize(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim();
}

/* ===== 索引(localStorage) ===== */

const KEY = "trpg.play.index.v1";

export interface PlayIndexEntry {
  id: string;
  title: string;
  systemId: string;
  /** 表示用に解決済みのシステム名(保存時に確定。全システムで正しく出すため)。 */
  systemLabel?: string;
  /** 卓のタグ(ロビーのカードに表示)。 */
  tags?: string[];
  /** 一覧カードのサムネイル(前景/背景を縮小した data URL)。 */
  thumbnail?: string;
  path: string;
  /** パネル数(一覧表示の補助)。 */
  panelCount: number;
  updatedAt: string;
}

export function getPlayIndex(): PlayIndexEntry[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as PlayIndexEntry[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function persist(list: PlayIndexEntry[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // 索引は副次的なので容量超過等は無視。
  }
}

export function upsertPlayIndex(
  list: PlayIndexEntry[],
  entry: PlayIndexEntry,
): PlayIndexEntry[] {
  const rest = list.filter((e) => e.id !== entry.id && e.path !== entry.path);
  const next = [entry, ...rest].sort((a, b) =>
    a.updatedAt < b.updatedAt ? 1 : -1,
  );
  persist(next);
  return next;
}

export function removePlayIndex(
  list: PlayIndexEntry[],
  id: string,
): PlayIndexEntry[] {
  const next = list.filter((e) => e.id !== id);
  persist(next);
  return next;
}

export function buildPlayIndexEntry(
  scene: PlayScene,
  path: string,
  extra?: { systemLabel?: string; thumbnail?: string },
): PlayIndexEntry {
  return {
    id: scene.id,
    title: scene.title || "(無題の卓)",
    systemId: scene.systemId,
    systemLabel: extra?.systemLabel,
    tags: scene.tags && scene.tags.length > 0 ? scene.tags : undefined,
    thumbnail: extra?.thumbnail,
    path,
    panelCount: scene.panels.length,
    updatedAt: new Date().toISOString(),
  };
}

import { PLAY_SCHEMA_VERSION, type PlayScene } from "./types.js";

/**
 * 卓ファイル(.play = PlayScene の JSON)の読み書き・複製。
 * デスクトップの .play と Web の書き出しは同じ形式なので、相互に持ち運べる。
 */

export class PlayFileError extends Error {}

/** 読み込める .play の上限(画像を data URL で抱えた卓を想定して 30MB)。 */
export const MAX_PLAY_FILE_CHARS = 30 * 1024 * 1024;

/**
 * 旧 .play の前方互換。BGM / シーンが無い卓でも落ちないよう既定値を補う
 * (スキーマ版は据え置き = 既存フィールドの追加のみ)。
 */
export function migratePlayScene(scene: PlayScene): PlayScene {
  const board = scene.board ?? { image: null, grid: true };
  const bgm = scene.bgm ?? { tracks: [] };
  if (scene.scenes && scene.scenes.length > 0 && scene.activeSceneId) {
    return { ...scene, board, bgm };
  }
  const firstSceneId = `${scene.id}::s1`;
  return {
    ...scene,
    board,
    bgm,
    scenes: [{ id: firstSceneId, name: "シーン1", board }],
    activeSceneId: firstSceneId,
  };
}

/** .play の文字列を検証して PlayScene にする。 */
export function parsePlayFile(text: string): PlayScene {
  if (text.length > MAX_PLAY_FILE_CHARS) {
    throw new PlayFileError("ファイルが大きすぎます(30MB まで)。");
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new PlayFileError("卓ファイル(.play)として読めませんでした。");
  }
  const s = data as Partial<PlayScene> | null;
  if (!s || typeof s !== "object" || typeof s.id !== "string") {
    throw new PlayFileError("卓ファイル(.play)として読めませんでした。");
  }
  if (s.schemaVersion !== PLAY_SCHEMA_VERSION) {
    throw new PlayFileError(
      `未対応の卓ファイルの版です(${String(s.schemaVersion)})。Re-dice を最新にしてください。`,
    );
  }
  if (!Array.isArray(s.panels) || !Array.isArray(s.log)) {
    throw new PlayFileError("卓ファイルが壊れているため、読み込めませんでした。");
  }
  const scene: PlayScene = {
    ...(s as PlayScene),
    title: typeof s.title === "string" ? s.title : "読み込んだ卓",
    systemId: typeof s.systemId === "string" ? s.systemId : "",
    meta: {
      createdAt: s.meta?.createdAt ?? new Date(0).toISOString(),
      updatedAt: s.meta?.updatedAt ?? new Date(0).toISOString(),
    },
  };
  return migratePlayScene(scene);
}

export function serializePlayFile(scene: PlayScene): string {
  return JSON.stringify(scene, null, 2);
}

/**
 * 卓を別の卓として複製する(新しい id)。
 * keepLog=false(既定)なら、ログとターンを消した「同じ準備の新しい卓」になる
 * (同じシナリオを別の卓で回すとき用)。
 */
export function clonePlayScene(
  scene: PlayScene,
  opts: { id: string; now: string; title?: string; keepLog?: boolean },
): PlayScene {
  const out: PlayScene = {
    ...scene,
    id: opts.id,
    title: opts.title ?? `${scene.title}(コピー)`,
    meta: { createdAt: opts.now, updatedAt: opts.now },
  };
  if (!opts.keepLog) {
    out.log = [];
    delete out.turn;
  }
  return out;
}

/** ファイル名に使えない文字を除いた卓の名前。 */
export function playFileName(scene: PlayScene): string {
  const base = (scene.title || "卓").replace(/[\\/:*?"<>|\n\r\t]/g, "_").trim();
  return `${base || "卓"}.play`;
}

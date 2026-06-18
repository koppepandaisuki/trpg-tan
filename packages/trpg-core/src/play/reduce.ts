import {
  PLAY_SCHEMA_VERSION,
  type PlayScene,
  type PlayEvent,
} from "./types.js";

/**
 * PlayScene のイベント遷移(純粋・決定論的)。乱数や時刻に依存しない。
 * ダイスの結果はイベント生成時(actions.ts)に確定済みなので、ここでは
 * ログへの追記と状態の前進だけを行う。
 */

/** 空のシーンを作る(id/時刻は呼び出し側)。 */
export function createScene(params: {
  id: string;
  title: string;
  systemId?: string;
  now: string;
}): PlayScene {
  const firstSceneId = `${params.id}::s1`;
  return {
    schemaVersion: PLAY_SCHEMA_VERSION,
    id: params.id,
    title: params.title || "新しい卓",
    systemId: params.systemId ?? "",
    panels: [],
    board: { image: null, grid: true },
    bgm: { tracks: [] },
    scenes: [{ id: firstSceneId, name: "シーン1", board: { image: null, grid: true } }],
    activeSceneId: firstSceneId,
    log: [],
    meta: { createdAt: params.now, updatedAt: params.now },
  };
}

export function reduce(scene: PlayScene, event: PlayEvent): PlayScene {
  const log = [...scene.log, event];
  const meta = { ...scene.meta, updatedAt: event.ts };

  switch (event.kind) {
    case "panel-add": {
      if (scene.panels.some((p) => p.id === event.panel.id)) {
        return { ...scene, log, meta };
      }
      return { ...scene, panels: [...scene.panels, event.panel], log, meta };
    }
    case "panel-remove": {
      return {
        ...scene,
        panels: scene.panels.filter((p) => p.id !== event.panelId),
        log,
        meta,
      };
    }
    case "resource": {
      const panels = scene.panels.map((p) => {
        if (p.id !== event.panelId) return p;
        return {
          ...p,
          resources: p.resources.map((r) =>
            r.key === event.resourceKey ? { ...r, current: event.current } : r,
          ),
        };
      });
      return { ...scene, panels, log, meta };
    }
    case "panel-move": {
      const panels = scene.panels.map((p) =>
        p.id === event.panelId
          ? { ...p, pos: { x: event.x, y: event.y } }
          : p,
      );
      return { ...scene, panels, log, meta };
    }
    case "panel-update": {
      const panels = scene.panels.map((p) =>
        p.id === event.panelId ? { ...p, ...event.patch } : p,
      );
      return { ...scene, panels, log, meta };
    }
    case "board-set": {
      const prev = scene.board ?? { image: null, grid: true };
      const board = {
        image: event.image !== undefined ? event.image : prev.image,
        grid: event.grid !== undefined ? event.grid : prev.grid,
        foreground:
          event.foreground !== undefined ? event.foreground : prev.foreground,
        bgScale: event.bgScale !== undefined ? event.bgScale : prev.bgScale,
        fgScale: event.fgScale !== undefined ? event.fgScale : prev.fgScale,
        bgBlur: event.bgBlur !== undefined ? event.bgBlur : prev.bgBlur,
      };
      // active シーンの盤面にも反映。
      const scenes = scene.scenes?.map((s) =>
        s.id === scene.activeSceneId ? { ...s, board } : s,
      );
      return { ...scene, board, scenes, log, meta };
    }
    case "scene-add": {
      const scenes = [...(scene.scenes ?? []), event.scene];
      return {
        ...scene,
        scenes,
        activeSceneId: event.scene.id,
        board: event.scene.board,
        log,
        meta,
      };
    }
    case "scene-select": {
      const target = scene.scenes?.find((s) => s.id === event.sceneId);
      if (!target) return { ...scene, log, meta };
      return {
        ...scene,
        activeSceneId: event.sceneId,
        board: target.board,
        log,
        meta,
      };
    }
    case "scene-rename": {
      const scenes = scene.scenes?.map((s) =>
        s.id === event.sceneId ? { ...s, name: event.name } : s,
      );
      return { ...scene, scenes, log, meta };
    }
    case "scene-remove": {
      const scenes = scene.scenes ?? [];
      if (scenes.length <= 1) return { ...scene, log, meta }; // 最後の1つは残す
      const next = scenes.filter((s) => s.id !== event.sceneId);
      let activeSceneId = scene.activeSceneId;
      let board = scene.board;
      if (scene.activeSceneId === event.sceneId) {
        activeSceneId = next[0].id;
        board = next[0].board;
      }
      return { ...scene, scenes: next, activeSceneId, board, log, meta };
    }
    case "turn-set": {
      return {
        ...scene,
        turn: { round: event.round, activePanelId: event.activePanelId },
        log,
        meta,
      };
    }
    case "chat":
    case "roll":
    case "system":
      return { ...scene, log, meta };
    case "log-clear":
      // 履歴を空に。駒/盤面/シーン等の状態フィールドはそのまま(別管理なので無傷)。
      return { ...scene, log: [], meta };
    default: {
      // 未知イベントは無視(前方互換)。網羅性は型で担保。
      const _exhaustive: never = event;
      void _exhaustive;
      return { ...scene, log, meta };
    }
  }
}

/** 複数イベントをまとめて適用(スナップショット + 追従イベントの再構成)。 */
export function reduceAll(scene: PlayScene, events: PlayEvent[]): PlayScene {
  return events.reduce(reduce, scene);
}

/** リソースの増減を適用した結果の現在値(0..max にクランプ)を返すヘルパ。 */
export function clampResource(
  current: number,
  delta: number,
  max: number,
): number {
  return Math.max(0, Math.min(max, current + delta));
}

import { type RandomFn, defaultRandom } from "../dice/random.js";
import { rollNotation } from "../dice/notation.js";
import { rollCoCCheck, type CoCEdition } from "../dice/coc-check.js";
import { compareRoll, type CompareOp } from "../dice/command.js";
import type {
  Panel,
  PanelVariant,
  PanelResource,
  ChatEvent,
  RollEvent,
  ResourceEvent,
  PanelAddEvent,
  PanelRemoveEvent,
  SystemEvent,
  PanelMoveEvent,
  PanelUpdateEvent,
  BoardSetEvent,
  SceneInfo,
  SceneAddEvent,
  SceneSelectEvent,
  SceneRenameEvent,
  SceneRemoveEvent,
} from "./types.js";
import { clampResource } from "./reduce.js";

/**
 * イベント生成ヘルパ(権威=GM 側で呼ぶ)。乱数を *ここで* 消費し、結果を
 * イベントに刻む。id/ts/rng は注入(環境非依存・テスト容易)。
 *
 * 生成したイベントを reduce() で適用すれば状態が前進し、同じイベントを
 * 後でネットワークに流せば全員が同じ状態を再構成できる。
 */

export interface EventCtx {
  id: string;
  ts: string;
  rng?: RandomFn;
}

export function chatEvent(
  ctx: EventCtx,
  actor: string,
  text: string,
  channel?: string,
): ChatEvent {
  return {
    id: ctx.id,
    ts: ctx.ts,
    actor,
    kind: "chat",
    text,
    ...(channel ? { channel } : {}),
  };
}

export function systemEvent(ctx: EventCtx, text: string): SystemEvent {
  return { id: ctx.id, ts: ctx.ts, actor: "system", kind: "system", text };
}

/** 技能/能力判定(CoC)。target は版差を解決済みの目標値。 */
export function checkEvent(
  ctx: EventCtx,
  actor: string,
  label: string,
  target: number,
  edition: CoCEdition,
): RollEvent {
  const result = rollCoCCheck(target, edition, ctx.rng ?? defaultRandom);
  return {
    id: ctx.id,
    ts: ctx.ts,
    actor,
    kind: "roll",
    label,
    dice: [result.roll],
    total: result.roll,
    check: result,
  };
}

/** フリーダイス(記法評価)。label を省略すると記法そのものを表示名にする。 */
export function freeRollEvent(
  ctx: EventCtx,
  actor: string,
  notation: string,
  label?: string,
): RollEvent {
  const r = rollNotation(notation, ctx.rng ?? defaultRandom);
  return {
    id: ctx.id,
    ts: ctx.ts,
    actor,
    kind: "roll",
    label: label ?? notation,
    notation,
    dice: r.rolls,
    total: r.total,
  };
}

/** 比較付きロール(2d6>=8 等)。成否を刻む。 */
export function compareRollEvent(
  ctx: EventCtx,
  actor: string,
  notation: string,
  op: CompareOp,
  target: number,
  label?: string,
): RollEvent {
  const r = compareRoll(notation, op, target, ctx.rng ?? defaultRandom);
  return {
    id: ctx.id,
    ts: ctx.ts,
    actor,
    kind: "roll",
    label: label ?? `${notation}${op}${target}`,
    notation,
    dice: r.rolls,
    total: r.total,
    success: r.success,
    compare: { op, target },
  };
}

export function panelAddEvent(ctx: EventCtx, panel: Panel): PanelAddEvent {
  return { id: ctx.id, ts: ctx.ts, actor: "GM", kind: "panel-add", panel };
}

export function panelRemoveEvent(
  ctx: EventCtx,
  panelId: string,
): PanelRemoveEvent {
  return {
    id: ctx.id,
    ts: ctx.ts,
    actor: "GM",
    kind: "panel-remove",
    panelId,
  };
}

/** 駒を盤面上で移動(x,y は 0..1 正規化)。 */
export function panelMoveEvent(
  ctx: EventCtx,
  panelId: string,
  x: number,
  y: number,
): PanelMoveEvent {
  return {
    id: ctx.id,
    ts: ctx.ts,
    actor: "GM",
    kind: "panel-move",
    panelId,
    x: clamp01(x),
    y: clamp01(y),
  };
}

/** 駒の属性(名前/情報/秘匿)を更新。指定したフィールドだけ反映。 */
export function panelUpdateEvent(
  ctx: EventCtx,
  panelId: string,
  patch: {
    name?: string;
    note?: string;
    hidden?: boolean;
    size?: number;
    palette?: string;
    speed?: number;
    sceneId?: string | null;
    layer?: number;
    locked?: boolean;
    portrait?: string | null;
    variants?: PanelVariant[];
  },
): PanelUpdateEvent {
  return {
    id: ctx.id,
    ts: ctx.ts,
    actor: "GM",
    kind: "panel-update",
    panelId,
    patch,
  };
}

/** 盤面設定(背景画像 / グリッド)の変更。指定したフィールドだけ反映。 */
export function boardSetEvent(
  ctx: EventCtx,
  patch: { image?: string | null; grid?: boolean },
): BoardSetEvent {
  return {
    id: ctx.id,
    ts: ctx.ts,
    actor: "GM",
    kind: "board-set",
    ...(patch.image !== undefined ? { image: patch.image } : {}),
    ...(patch.grid !== undefined ? { grid: patch.grid } : {}),
  };
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** シーン追加(追加後そのシーンへ切替)。空盤面で作る。 */
export function sceneAddEvent(
  ctx: EventCtx,
  scene: { id: string; name: string },
): SceneAddEvent {
  const info: SceneInfo = {
    id: scene.id,
    name: scene.name,
    board: { image: null, grid: true },
  };
  return { id: ctx.id, ts: ctx.ts, actor: "GM", kind: "scene-add", scene: info };
}

/** シーン切替。 */
export function sceneSelectEvent(
  ctx: EventCtx,
  sceneId: string,
): SceneSelectEvent {
  return {
    id: ctx.id,
    ts: ctx.ts,
    actor: "GM",
    kind: "scene-select",
    sceneId,
  };
}

/** シーン名の変更。 */
export function sceneRenameEvent(
  ctx: EventCtx,
  sceneId: string,
  name: string,
): SceneRenameEvent {
  return {
    id: ctx.id,
    ts: ctx.ts,
    actor: "GM",
    kind: "scene-rename",
    sceneId,
    name,
  };
}

/** シーン削除(最後の1つは消せない)。 */
export function sceneRemoveEvent(
  ctx: EventCtx,
  sceneId: string,
): SceneRemoveEvent {
  return {
    id: ctx.id,
    ts: ctx.ts,
    actor: "GM",
    kind: "scene-remove",
    sceneId,
  };
}

/**
 * リソース増減イベント。現在のパネル/リソースを見て delta を 0..max に
 * クランプした結果を刻む(reduce 側は current をそのまま適用)。
 */
export function resourceEvent(
  ctx: EventCtx,
  actor: string,
  panel: Panel,
  resource: PanelResource,
  delta: number,
): ResourceEvent {
  const current = clampResource(resource.current, delta, resource.max);
  return {
    id: ctx.id,
    ts: ctx.ts,
    actor,
    kind: "resource",
    panelId: panel.id,
    resourceKey: resource.key,
    label: resource.label,
    delta: current - resource.current,
    current,
  };
}

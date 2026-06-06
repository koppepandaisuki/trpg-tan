import { type RandomFn, defaultRandom } from "../dice/random.js";
import { rollNotation } from "../dice/notation.js";
import { rollCoCCheck, type CoCEdition } from "../dice/coc-check.js";
import type {
  Panel,
  PanelResource,
  ChatEvent,
  RollEvent,
  ResourceEvent,
  PanelAddEvent,
  PanelRemoveEvent,
  SystemEvent,
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
): ChatEvent {
  return { id: ctx.id, ts: ctx.ts, actor, kind: "chat", text };
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

/** フリーダイス(記法評価)。 */
export function freeRollEvent(
  ctx: EventCtx,
  actor: string,
  notation: string,
): RollEvent {
  const r = rollNotation(notation, ctx.rng ?? defaultRandom);
  return {
    id: ctx.id,
    ts: ctx.ts,
    actor,
    kind: "roll",
    label: notation,
    notation,
    dice: r.rolls,
    total: r.total,
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

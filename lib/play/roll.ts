import {
  chatEvent,
  checkEvent,
  freeRollEvent,
  compareRollEvent,
  diceBotRollEvent,
  parseDiceCommand,
  panelVariables,
  substituteVars,
  type EventCtx,
  type Panel,
  type PlayEvent,
  type PlayScene,
} from "@trpg/core";

/**
 * チャット入力 1 行 → 確定イベント(チャット or ダイス)。
 *
 * デスクトップ版 PlayTable.handleSend と同じ解釈順で、Web でも同じ出目・
 * 同じ表示になるようにする:
 *   1. チャパレ変数({共鳴} 等)を発言者の駒データで置換
 *   2. ダイスボット(システム固有コマンド)を先に解釈
 *   3. 汎用のダイスコマンド(CC<= / 2d6>=8 / 1d100 / choice[...])
 *   4. どれでもなければ普通の発言
 *
 * 乱数は GM 側だけで消費する(参加者の入力は intent として GM に渡り、
 * ここを通って全員に配信される)ので、全員の出目が必ず一致する。
 */
export function resolveInputToEvent(params: {
  ctx: EventCtx;
  scene: PlayScene;
  /** 発言者の駒 id。"GM" なら地の声。 */
  speakerId: string;
  raw: string;
  /** 発言者の表示名の上書き(参加者が自分の名前で喋るとき)。 */
  as?: string;
  channel?: string;
  color?: string;
  secret?: boolean;
  visibleTo?: string[];
}): PlayEvent | null {
  const { ctx, scene, speakerId, as, channel, color } = params;
  const speakerPanel: Panel | undefined = scene.panels.find(
    (p) => p.id === speakerId,
  );
  const name = as ?? speakerPanel?.name ?? "GM";
  const ch = channel && channel !== "main" ? channel : undefined;

  // チャパレ変数の置換(駒が特定できる発言のみ)。
  let raw = params.raw.trim();
  if (!raw) return null;
  if (speakerPanel) raw = substituteVars(raw, panelVariables(speakerPanel));

  const decorate = (ev: PlayEvent): PlayEvent => {
    let out = ev;
    if (ch) out = { ...out, channel: ch } as PlayEvent;
    if (color) out = { ...out, color } as PlayEvent;
    if (params.secret && out.kind === "roll") {
      out = { ...out, secret: true, visibleTo: params.visibleTo ?? [] };
    }
    return out;
  };

  // 1) システム固有のダイスボット(卓のシステム or 駒のダイスボット)。
  const bot = speakerPanel?.diceBot ?? scene.diceBot;
  if (bot) {
    const botEv = diceBotRollEvent(ctx, name, raw, bot);
    if (botEv) return decorate(botEv);
  }

  // 2) 汎用ダイスコマンド。
  const cmd = parseDiceCommand(raw);
  if (cmd.kind === "none") {
    return decorate(chatEvent(ctx, name, raw, ch));
  }
  if (cmd.kind === "notation") {
    return decorate(freeRollEvent(ctx, name, cmd.notation, cmd.label));
  }
  if (cmd.kind === "coc") {
    // 版は駒 → 卓の systemId の順で解決(デスクトップ版 sceneEdition と同じ)。
    const edition = speakerPanel?.edition ?? (scene.systemId === "coc6" ? "6" : "7");
    return decorate(checkEvent(ctx, name, cmd.label, cmd.target, edition));
  }
  if (cmd.kind === "choice") {
    const base = freeRollEvent(ctx, name, `1d${cmd.options.length}`);
    const picked = cmd.options[(base.dice[0] ?? 1) - 1];
    return decorate({ ...base, label: `choice → ${picked}` });
  }
  return decorate(
    compareRollEvent(ctx, name, cmd.notation, cmd.op, cmd.target, cmd.label),
  );
}

/** イベント ctx を作る(id は uuid、ts は now)。 */
export function newEventCtx(): EventCtx {
  return { id: crypto.randomUUID(), ts: new Date().toISOString() };
}

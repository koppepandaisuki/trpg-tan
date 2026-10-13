import type {
  ChatEvent,
  Panel,
  PlayEvent,
  PlayScene,
  RollEvent,
} from "./types.js";

/**
 * 卓の「秘密」の振り分け(誰に何を見せるか)。
 *
 *   - シークレットダイス: 全員には「シークレットダイス」という印だけを送り、出目は
 *     見せる相手(visibleTo)にだけ個別に送る。
 *   - 個別チャット(channel = 駒 id): 全員には送らず、その駒の持ち主にだけ個別に送る。
 *
 * 個別に送るものは参加者ごとの鍵で暗号化する(seal.ts)。中継(全員に届く経路)を
 * 通っても、宛先以外の参加者には読めない。GM は常に全部を見ている(手元が正)。
 */

/** 個別チャット(メイン以外のチャンネル)の発言・ダイスか。 */
export function isPrivateChannel(ev: PlayEvent): boolean {
  return (
    (ev.kind === "chat" || ev.kind === "roll") &&
    !!ev.channel &&
    ev.channel !== "main"
  );
}

const redactCache = new WeakMap<RollEvent, RollEvent>();

/** シークレットダイスの出目を抜いた印(同じイベントには同じ参照を返す)。 */
export function redactRoll(ev: RollEvent): RollEvent {
  if (!ev.secret) return ev;
  let r = redactCache.get(ev);
  if (!r) {
    r = {
      id: ev.id,
      ts: ev.ts,
      actor: ev.actor,
      kind: "roll",
      label: "シークレットダイス",
      dice: [],
      total: 0,
      secret: true,
      visibleTo: [],
      redacted: true,
      ...(ev.channel ? { channel: ev.channel } : {}),
      ...(ev.color ? { color: ev.color } : {}),
    };
    redactCache.set(ev, r);
  }
  return r;
}

/**
 * 参加者全員へ送ってよい形。null = 全員には送らない(個別チャット)。
 * シークレットダイスは出目を抜いた印になる。
 */
export function publicEventFor(ev: PlayEvent): PlayEvent | null {
  if (isPrivateChannel(ev)) return null;
  if (ev.kind === "roll" && ev.secret) return redactRoll(ev);
  return ev;
}

function ownerName(p: Panel | undefined): string | null {
  return p?.owner && p.owner !== "GM" ? p.owner : null;
}

/**
 * その出来事の中身を個別に見せる相手(参加者の入室名)。GM は含めない。
 *   - シークレットダイス: visibleTo の駒の持ち主(駒 id / 駒名 / 入室名で指定できる)
 *   - 個別チャット: そのチャンネルの駒の持ち主
 */
export function privateRecipients(ev: PlayEvent, scene: PlayScene): string[] {
  const out = new Set<string>();
  if (ev.kind === "roll" && ev.secret) {
    for (const v of ev.visibleTo ?? []) {
      const p = scene.panels.find((x) => x.id === v || x.name === v);
      if (p) {
        const o = ownerName(p);
        if (o) out.add(o);
      } else if (v && v !== "GM") {
        out.add(v); // 入室名で直接指定
      }
    }
  } else if (isPrivateChannel(ev)) {
    const channel = (ev as ChatEvent | RollEvent).channel;
    const o = ownerName(scene.panels.find((x) => x.id === channel));
    if (o) out.add(o);
  }
  return [...out];
}

/**
 * 入室(再同期)した参加者へ、これまでの個別の出来事をまとめて渡すための一覧
 * (ログの末尾から最大 limit 件)。
 */
export function privateBacklog(
  scene: PlayScene,
  name: string,
  limit = 200,
): PlayEvent[] {
  const out: PlayEvent[] = [];
  for (let i = scene.log.length - 1; i >= 0 && out.length < limit; i--) {
    const ev = scene.log[i];
    if (ev.kind !== "chat" && ev.kind !== "roll") continue;
    if (!(ev.kind === "roll" && ev.secret) && !isPrivateChannel(ev)) continue;
    if (privateRecipients(ev, scene).includes(name)) out.push(ev);
  }
  return out.reverse();
}

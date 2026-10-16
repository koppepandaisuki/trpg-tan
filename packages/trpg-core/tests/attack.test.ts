import { describe, it, expect } from "vitest";
import {
  createRoom,
  createSigner,
  codeForKey,
  createGmGate,
  createMemberGate,
  createSceneBroadcaster,
  createSceneMirror,
  createScene,
  reduce,
  makeTokenPanel,
  panelAddEvent,
  type NetMsg,
  type MsgMeta,
  type RoomTransport,
} from "../src/play/index.js";

/**
 * なりすましの通し試験: GM・参加者・攻撃役が同じ中継(全員に届く broadcast)に乗る。
 * 攻撃役は GM を装った配信(卓の上書き・退室・閉卓)と、参加者を装った操作を送る。
 */

class Bus {
  members: Map<string, (p: unknown) => void>[] = [];
  join(): RoomTransport {
    const handlers = new Map<string, (p: unknown) => void>();
    this.members.push(handlers);
    return {
      send: async (e, p) => {
        for (const h of this.members) if (h !== handlers) h.get(e)?.(structuredClone(p));
        return true;
      },
      onBroadcast: (e, cb) => handlers.set(e, cb),
      onPresenceSync: () => {},
      close: async () => {},
    };
  }
}

const wait = () => new Promise((r) => setTimeout(r, 30));

describe("なりすまし対策の通し試験", () => {
  it("偽の GM 配信も、他人を装った操作も通らない", async () => {
    const bus = new Bus();
    const gmKey = await createSigner();
    const code = await codeForKey(gmKey.publicKey);

    // GM
    const gm = createRoom(bus.join(), { code, selfId: "gm", signer: gmKey });
    const members = createMemberGate();
    const intents: string[] = [];
    let s = createScene({ id: "t", title: "本物の卓", now: "2026-10-15T00:00:00.000Z" });
    s = reduce(s, panelAddEvent({ id: "e1", ts: "2026-10-15T00:00:00.000Z" }, { ...makeTokenPanel({ id: "a", name: "アリス" }), owner: "PL1" }));
    const b = createSceneBroadcaster({ send: (m) => gm.send(m), heartbeatMs: 0 });
    gm.onMessage((msg, meta) => {
      if (!members.accept(msg, meta)) return;
      if (msg.type === "hello") b.join(msg.proto);
      if (msg.type === "intent") intents.push(`${msg.from}:${msg.intent.kind}`);
    });
    b.update(s);

    // 参加者
    const plKey = await createSigner();
    const pl = createRoom(bus.join(), { code, selfId: "pl1", signer: plKey });
    const gate = createGmGate(code);
    const mirror = createSceneMirror();
    const seen: string[] = [];
    let q: Promise<void> = Promise.resolve();
    pl.onMessage((msg: NetMsg, meta: MsgMeta) => {
      q = q.then(async () => {
        if (!(await gate.accept(msg, meta))) return;
        seen.push(msg.type);
        mirror.receive(msg);
      });
    });
    await pl.send({ type: "hello", from: "pl1", name: "PL1", proto: 2 });
    await wait();
    await b.flush();
    await wait();
    expect(gate.verified).toBe(true);
    expect(mirror.scene?.title).toBe("本物の卓");

    // 攻撃役(自分の鍵で署名 / 署名なしの両方を試す)
    const badKey = await createSigner();
    const bad = createRoom(bus.join(), { code, selfId: "bad", signer: badKey });
    const badUnsigned = createRoom(bus.join(), { code, selfId: "bad2" });
    const fake = { ...mirror.scene!, title: "乗っ取られた卓" };
    for (const r of [bad, badUnsigned]) {
      await r.send({ type: "state", rev: 9999, epoch: "fake", scene: fake });
      await r.send({ type: "kick", to: "pl1" });
      await r.send({ type: "closed" });
      // 参加者 pl1 を装った操作
      await r.send({ type: "intent", from: "pl1", intent: { kind: "move", panelId: "a", x: 0, y: 0 } });
    }
    await wait();
    expect(mirror.scene?.title).toBe("本物の卓");
    expect(seen).not.toContain("kick");
    expect(seen).not.toContain("closed");
    expect(intents).toEqual([]); // 偽の操作は GM に受け付けられない

    // 本人の操作は通る
    await pl.send({ type: "intent", from: "pl1", intent: { kind: "move", panelId: "a", x: 0.5, y: 0.5 } });
    await wait();
    expect(intents).toEqual(["pl1:move"]);
  });
});

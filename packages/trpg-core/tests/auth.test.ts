import { describe, it, expect } from "vitest";
import {
  createSigner,
  verifySignature,
  codeForKey,
  createGmGate,
  createRoom,
  type NetMsg,
  type MsgMeta,
  type RoomTransport,
} from "../src/play/index.js";

/** なりすまし対策(署名・参加コードと GM の鍵の結び付け)。 */

function loopback() {
  const handlers = new Map<string, (p: unknown) => void>();
  const t: RoomTransport = {
    send: async (e, p) => {
      handlers.get(e)?.(structuredClone(p));
      return true;
    },
    onBroadcast: (e, cb) => handlers.set(e, cb),
    onPresenceSync: () => {},
    close: async () => {},
  };
  return t;
}

const tick = () => new Promise((r) => setTimeout(r, 20));

describe("署名", () => {
  it("署名した本人の鍵でだけ確かめられる / 改ざんは通らない", async () => {
    const a = await createSigner();
    const b = await createSigner();
    const sig = await a.sign("こんにちは");
    expect(await verifySignature(a.publicKey, "こんにちは", sig)).toBe(true);
    expect(await verifySignature(a.publicKey, "こんばんは", sig)).toBe(false);
    expect(await verifySignature(b.publicKey, "こんにちは", sig)).toBe(false);
    expect(await verifySignature("壊れた鍵", "こんにちは", sig)).toBe(false);
  });

  it("参加コードは公開鍵から決まる 6 文字(紛らわしい文字なし)", async () => {
    const a = await createSigner();
    const code = await codeForKey(a.publicKey);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(await codeForKey(a.publicKey)).toBe(code);
  });

  it("createRoom は送るメッセージに署名し、受け手は送り主の鍵を知る", async () => {
    const t = loopback();
    const signer = await createSigner();
    const room = createRoom(t, { code: "X", selfId: "me", signer });
    const got: [NetMsg, MsgMeta][] = [];
    room.onMessage((m, meta) => got.push([m, meta]));
    await room.send({ type: "telop", text: "第一章" });
    await tick();
    expect(got).toEqual([[{ type: "telop", text: "第一章" }, { signer: signer.publicKey }]]);
  });

  it("署名なし(旧版)は meta.signer なし", async () => {
    const t = loopback();
    const room = createRoom(t, { code: "X", selfId: "me" });
    const got: MsgMeta[] = [];
    room.onMessage((_m, meta) => got.push(meta));
    await room.send({ type: "closed" });
    await tick();
    expect(got).toEqual([{}]);
  });
});

describe("createGmGate(参加者側)", () => {
  it("本物の GM を確かめるまでは旧版の署名なしも通し、確かめた後は GM の署名だけ", async () => {
    const gm = await createSigner();
    const attacker = await createSigner();
    const gate = createGmGate(await codeForKey(gm.publicKey));
    const state = { type: "closed" } as NetMsg;

    expect(await gate.accept(state, {})).toBe(true); // 旧版の GM かもしれない
    expect(await gate.accept(state, { signer: attacker.publicKey })).toBe(false); // 別の鍵
    expect(await gate.accept(state, { signer: gm.publicKey })).toBe(true);
    expect(gate.verified).toBe(true);
    expect(await gate.accept(state, {})).toBe(false); // 以後は署名必須
    expect(await gate.accept(state, { signer: attacker.publicKey })).toBe(false);
    // 参加者どうしのメッセージ(参加者は使わない)は判定しない
    expect(await gate.accept({ type: "hello", from: "x", name: "y" }, {})).toBe(true);
  });
});

import { describe, it, expect } from "vitest";
import {
  createScene,
  reduce,
  makeTokenPanel,
  panelAddEvent,
  chatEvent,
  freeRollEvent,
  projectForPlayers,
  publicEventFor,
  privateRecipients,
  privateBacklog,
  createSecretBox,
  createSceneMirror,
  type PlayScene,
  type RollEvent,
} from "../src/play/index.js";

/**
 * 相手ごとの秘密(シークレットダイスの出目・個別チャット)。
 * 全員向けには印だけ / 何も送らず、宛先にだけ暗号化して送る。
 */

const NOW = "2026-10-14T00:00:00.000Z";
let n = 0;
const ctx = () => ({ id: `e${++n}`, ts: new Date(Date.parse(NOW) + n * 1000).toISOString(), rng: () => 0.5 });

function table(): PlayScene {
  let s = createScene({ id: "t", title: "卓", systemId: "coc7", now: NOW });
  s = reduce(s, panelAddEvent(ctx(), { ...makeTokenPanel({ id: "a", name: "アリス" }), owner: "PL1" }));
  s = reduce(s, panelAddEvent(ctx(), { ...makeTokenPanel({ id: "b", name: "ボブ" }), owner: "PL2" }));
  return s;
}

describe("誰に見せるか", () => {
  it("見せる相手(駒 id / 駒名 / 入室名)の持ち主に見せる", () => {
    const s = table();
    const roll: RollEvent = { ...freeRollEvent(ctx(), "GM", "1d100", "心理学"), secret: true, visibleTo: ["a", "ボブ", "PL3"] };
    expect(privateRecipients(roll, s).sort()).toEqual(["PL1", "PL2", "PL3"]);
    expect(publicEventFor(roll)).toMatchObject({ redacted: true, dice: [] });
  });
  it("個別チャットはチャンネルの駒の持ち主だけ。全員向けには送らない", () => {
    const s = table();
    const dm = chatEvent(ctx(), "GM", "あなただけに", "b");
    expect(privateRecipients(dm, s)).toEqual(["PL2"]);
    expect(publicEventFor(dm)).toBeNull();
  });
  it("GM だけのシークレットダイスは誰にも見せない", () => {
    const roll: RollEvent = { ...freeRollEvent(ctx(), "GM", "1d100"), secret: true, visibleTo: [] };
    expect(privateRecipients(roll, table())).toEqual([]);
  });
  it("入室した参加者に、自分宛ての過去の個別の出来事を渡す", () => {
    let s = table();
    s = reduce(s, chatEvent(ctx(), "GM", "PL1へ", "a"));
    s = reduce(s, chatEvent(ctx(), "GM", "PL2へ", "b"));
    s = reduce(s, chatEvent(ctx(), "GM", "みんなへ"));
    expect(privateBacklog(s, "PL1").map((e) => (e as { text: string }).text)).toEqual(["PL1へ"]);
    // 全員向けの投影には個別チャットが載らない
    expect(JSON.stringify(projectForPlayers(s))).not.toContain("PL1へ");
  });
});

describe("createSecretBox(ECDH + AES-GCM)", () => {
  it("宛先だけが開ける", async () => {
    const gm = await createSecretBox();
    const pl1 = await createSecretBox();
    const pl2 = await createSecretBox();
    await gm.addPeer("p1", pl1.publicKey);
    await gm.addPeer("p2", pl2.publicKey);
    await pl1.addPeer("GM", gm.publicKey);
    await pl2.addPeer("GM", gm.publicKey);

    const sealed = (await gm.seal("p1", { type: "telop", text: "秘密" }))!;
    expect(sealed.to).toBe("p1");
    expect(sealed.data).not.toContain("秘密");
    expect(await pl1.open("GM", sealed)).toEqual({ type: "telop", text: "秘密" });
    expect(await pl2.open("GM", sealed)).toBeNull(); // 他の参加者には読めない
  });
  it("同じ id の鍵を後から別の鍵で上書きさせない", async () => {
    const gm = await createSecretBox();
    const real = await createSecretBox();
    const fake = await createSecretBox();
    expect(await gm.addPeer("p1", real.publicKey)).toBe(true);
    expect(await gm.addPeer("p1", fake.publicKey)).toBe(false);
    await real.addPeer("GM", gm.publicKey);
    await fake.addPeer("GM", gm.publicKey);
    const sealed = (await gm.seal("p1", { type: "closed" }))!;
    expect(await real.open("GM", sealed)).toEqual({ type: "closed" });
    expect(await fake.open("GM", sealed)).toBeNull();
  });
  it("鍵の無い相手には作らない / 壊れた公開鍵は受け付けない", async () => {
    const gm = await createSecretBox();
    expect(await gm.seal("nobody", { type: "closed" })).toBeNull();
    expect(await gm.addPeer("x", "not-a-key")).toBe(false);
  });
});

describe("参加者側: 個別に届いた中身を反映", () => {
  it("印を中身に置き換え、個別チャットは時刻順に差し込み、全量の受信後も保つ", () => {
    let s = table();
    const secret: RollEvent = { ...freeRollEvent(ctx(), "GM", "1d100", "心理学"), secret: true, visibleTo: ["a"] };
    const dm = chatEvent(ctx(), "GM", "PL1だけ", "a");
    s = reduce(reduce(s, secret), dm);
    s = reduce(s, chatEvent(ctx(), "GM", "全員へ"));

    const mirror = createSceneMirror();
    mirror.receive({ type: "state", rev: 1, epoch: "e", scene: projectForPlayers(s) });
    expect(mirror.scene!.log.find((e) => e.id === secret.id)).toMatchObject({ redacted: true });
    expect(mirror.scene!.log.some((e) => e.id === dm.id)).toBe(false);

    const r = mirror.receive({ type: "reveal", evs: [secret, dm] });
    expect(r.changed).toBe(true);
    const ids = mirror.scene!.log.filter((e) => e.kind === "chat" || e.kind === "roll").map((e) => e.id);
    expect(ids).toEqual([secret.id, dm.id, s.log.at(-1)!.id]); // 時刻順
    expect(mirror.scene!.log.find((e) => e.id === secret.id)).toBe(secret);

    // 再同期(全量)で印が戻ってきても、中身を保つ
    mirror.receive({ type: "state", rev: 2, epoch: "e", scene: projectForPlayers(s) });
    expect(mirror.scene!.log.find((e) => e.id === secret.id)).toBe(secret);
    expect(mirror.scene!.log.some((e) => e.id === dm.id)).toBe(true);
  });
});

describe("sendPrivateEvents", () => {
  it("宛先の参加者にだけ、その人に見せる出来事を送る", async () => {
    const { sendPrivateEvents } = await import("../src/play/index.js");
    let s = table();
    const dm1 = chatEvent(ctx(), "GM", "PL1へ", "a");
    const pub = chatEvent(ctx(), "GM", "全員へ");
    s = reduce(reduce(s, dm1), pub);
    const gm = await createSecretBox();
    const p1 = await createSecretBox();
    const p2 = await createSecretBox();
    await gm.addPeer("id1", p1.publicKey);
    await gm.addPeer("id2", p2.publicKey);
    await p1.addPeer("GM", gm.publicKey);
    const sent: unknown[] = [];
    await sendPrivateEvents({
      box: gm,
      send: async (m) => void sent.push(m),
      members: new Map([["id1", "PL1"], ["id2", "PL2"]]),
      scene: s,
      evs: [dm1, pub],
    });
    expect(sent).toHaveLength(1);
    const opened = await p1.open("GM", sent[0] as never);
    expect(opened).toEqual({ type: "reveal", evs: [dm1] });
  });
});

describe("入室名宛て(ハンドアウトの配布など)", () => {
  it("駒が無くても、入室名宛てなら届く。全員向けには送らない", async () => {
    const { directChannel, directRecipient } = await import("../src/play/index.js");
    const ho = chatEvent(ctx(), "GM", "【HO1 探偵】依頼を受けた", directChannel("PL3"));
    expect(directRecipient(ho.channel)).toBe("PL3");
    expect(privateRecipients(ho, table())).toEqual(["PL3"]);
    expect(publicEventFor(ho)).toBeNull();
  });
});

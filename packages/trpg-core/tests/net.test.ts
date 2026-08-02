import { describe, it, expect, vi } from "vitest";
import {
  createRoom,
  makeRoomCode,
  roomTopic,
  type NetMsg,
  type RoomTransport,
} from "../src/play/net.js";

/**
 * 同期プロトコル(チャンク分割・再組立・ack 再送・逐次キュー)のテスト。
 * トランスポートを注入できるようにした結果、Supabase 無しで検証できる。
 */

/** 送ったチャンクをそのまま自分に配る「ループバック」トランスポート。 */
function loopback(opts?: { failFirst?: number }) {
  const handlers = new Map<string, (payload: unknown) => void>();
  const sent: { event: string; payload: unknown }[] = [];
  let remainingFailures = opts?.failFirst ?? 0;
  const transport: RoomTransport = {
    send: async (event, payload) => {
      if (remainingFailures > 0) {
        remainingFailures -= 1;
        return false; // ack 失敗 → 呼び出し側が再送するはず
      }
      sent.push({ event, payload });
      handlers.get(event)?.(payload);
      return true;
    },
    onBroadcast: (event, cb) => handlers.set(event, cb),
    onPresenceSync: () => {},
    close: async () => {},
  };
  return { transport, sent, handlers };
}

const baseParams = { code: "ABC123", selfId: "self-1" };

describe("makeRoomCode", () => {
  it("紛らわしい文字を含まない 6 桁を作る", () => {
    // 乱数を固定して決定的に検証(0,1,2,... を返す)。
    const code = makeRoomCode((n) => Uint32Array.from({ length: n }, (_, i) => i));
    expect(code).toHaveLength(6);
    expect(code).toBe("ABCDEF");
    // I / O / 0 / 1 は紛らわしいので集合に入れていない。
    expect(code).not.toMatch(/[IO01]/);
  });
});

describe("roomTopic", () => {
  it("参加コードから topic を作る", () => {
    expect(roomTopic("XYZ789")).toBe("play_XYZ789");
  });
});

describe("createRoom", () => {
  it("小さいメッセージを 1 チャンクで送受信できる", async () => {
    const { transport, sent } = loopback();
    const room = createRoom(transport, baseParams);
    const received: NetMsg[] = [];
    room.onMessage((m) => received.push(m));

    await room.send({ type: "hello", from: "self-1", name: "GM" });

    expect(sent).toHaveLength(1);
    expect(received).toEqual([{ type: "hello", from: "self-1", name: "GM" }]);
  });

  it("巨大なメッセージを複数チャンクに割って送り、受信側で復元する", async () => {
    const { transport, sent } = loopback();
    const room = createRoom(transport, baseParams);
    const received: NetMsg[] = [];
    room.onMessage((m) => received.push(m));

    // CHUNK(60,000 文字)を確実に超えるペイロード。
    const big = "あ".repeat(100_000);
    await room.send({ type: "telop", text: big });

    expect(sent.length).toBeGreaterThan(1); // 分割された
    expect(received).toHaveLength(1); // 1 通に戻った
    const msg = received[0];
    expect(msg.type).toBe("telop");
    if (msg.type === "telop") expect(msg.text).toBe(big);
  });

  it("複数チャンク受信中は進捗を通知し、完了で null に戻る", async () => {
    const { transport } = loopback();
    const room = createRoom(transport, baseParams);
    const progress: ({ received: number; total: number } | null)[] = [];
    room.onProgress((p) => progress.push(p));

    await room.send({ type: "telop", text: "x".repeat(150_000) });

    expect(progress.length).toBeGreaterThan(1);
    expect(progress.at(-1)).toBeNull(); // 完了で null
    const mid = progress[0];
    expect(mid).not.toBeNull();
    if (mid) expect(mid.total).toBeGreaterThan(1);
  });

  it("ack 失敗は再送する(1 回失敗しても最終的に届く)", async () => {
    vi.useFakeTimers();
    try {
      const { transport } = loopback({ failFirst: 1 });
      const room = createRoom(transport, baseParams);
      const received: NetMsg[] = [];
      room.onMessage((m) => received.push(m));

      const task = room.send({ type: "closed" });
      await vi.runAllTimersAsync(); // 再送の待ち時間を進める
      await task;

      expect(received).toEqual([{ type: "closed" }]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("transform が送信直前に適用される(メディアの URL 差し替え用)", async () => {
    const { transport } = loopback();
    const room = createRoom(transport, {
      ...baseParams,
      transform: async (msg) =>
        msg.type === "telop" ? { ...msg, text: `[変換]${msg.text}` } : msg,
    });
    const received: NetMsg[] = [];
    room.onMessage((m) => received.push(m));

    await room.send({ type: "telop", text: "こんばんは" });

    expect(received[0]).toEqual({ type: "telop", text: "[変換]こんばんは" });
  });

  it("sendLive は live イベントとして投げっぱなしにする", () => {
    const { transport, sent } = loopback();
    const room = createRoom(transport, baseParams);
    const live: unknown[] = [];
    room.onLive((m) => live.push(m));

    room.sendLive({ kind: "drag", panelId: "p1", x: 0.5, y: 0.25 });

    expect(sent[0].event).toBe("live");
    expect(live).toEqual([{ kind: "drag", panelId: "p1", x: 0.5, y: 0.25 }]);
  });

  it("壊れた JSON を受け取っても落ちない", () => {
    const { transport, handlers } = loopback();
    const room = createRoom(transport, baseParams);
    const received: NetMsg[] = [];
    room.onMessage((m) => received.push(m));

    // 単一チャンクで壊れた本文が届いたケース。
    expect(() =>
      handlers.get("chunk")?.({ mid: "m1", i: 0, n: 1, data: "{壊れた" }),
    ).not.toThrow();
    expect(received).toEqual([]);
  });
});

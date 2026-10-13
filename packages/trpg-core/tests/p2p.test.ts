import { describe, it, expect } from "vitest";
import {
  createHybridTransport,
  createRoom,
  utf8Length,
  type LinkStatus,
  type NetMsg,
  type PeerInfo,
  type RtcDataChannelLike,
  type RtcPeerConnectionLike,
  type RtcSessionDescriptionLike,
  type SignalingTransport,
} from "../src/play/index.js";

/**
 * P2P + 中継のハイブリッド通信(p2p.ts)のテスト。
 * WebRTC は「メモリ内で 2 つの接続をつなぐ偽物」で置き換える。
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ===== 偽の WebRTC ===== */

class FakeNet {
  blocked = false;
  byToken = new Map<string, FakePc>();
  seq = 0;
}

class FakeDc implements RtcDataChannelLike {
  readyState = "connecting";
  bufferedAmount = 0;
  bufferedAmountLowThreshold = 0;
  onopen: ((ev: unknown) => void) | null = null;
  onclose: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onbufferedamountlow: ((ev: unknown) => void) | null = null;
  peer: FakeDc | null = null;
  sent: string[] = [];
  send(data: string) {
    if (this.readyState !== "open") throw new Error("not open");
    this.sent.push(data);
    const peer = this.peer;
    queueMicrotask(() => peer?.onmessage?.({ data }));
  }
  open() {
    this.readyState = "open";
    this.onopen?.({});
  }
  close() {
    if (this.readyState === "closed") return;
    this.readyState = "closed";
    this.onclose?.({});
    this.peer?.close();
  }
}

class FakePc implements RtcPeerConnectionLike {
  connectionState = "new";
  iceGatheringState = "new";
  localDescription: RtcSessionDescriptionLike | null = null;
  sctp = { maxMessageSize: 262_144 };
  onicegatheringstatechange: ((ev: unknown) => void) | null = null;
  onconnectionstatechange: ((ev: unknown) => void) | null = null;
  ondatachannel: ((ev: { channel: RtcDataChannelLike }) => void) | null = null;
  dc: FakeDc | null = null;
  id: number;
  constructor(private net: FakeNet) {
    this.id = ++net.seq;
  }
  createDataChannel() {
    this.dc = new FakeDc();
    return this.dc;
  }
  async createOffer() {
    return { type: "offer", sdp: `offer-${this.id}` };
  }
  async createAnswer() {
    return { type: "answer", sdp: `answer-${this.id}` };
  }
  async setLocalDescription(d: RtcSessionDescriptionLike) {
    this.localDescription = d;
    this.iceGatheringState = "complete";
    this.net.byToken.set(d.sdp!, this);
  }
  async setRemoteDescription(d: RtcSessionDescriptionLike) {
    if (d.type !== "answer" || this.net.blocked) return;
    const answerer = this.net.byToken.get(d.sdp!);
    if (!answerer || !this.dc) return;
    const remote = new FakeDc();
    remote.peer = this.dc;
    this.dc.peer = remote;
    answerer.ondatachannel?.({ channel: remote });
    const local = this.dc;
    setTimeout(() => {
      this.connectionState = answerer.connectionState = "connected";
      local.open();
      remote.open();
    }, 1);
  }
  close() {
    this.connectionState = "closed";
    this.dc?.close();
  }
}

/* ===== 偽の中継(Supabase broadcast + presence) ===== */

interface Member {
  info: PeerInfo;
  handlers: Map<string, Array<(p: unknown) => void>>;
  peersCb: (peers: PeerInfo[]) => void;
}

class FakeRelay {
  members: Member[] = [];
  /** event ごとの中継回数(rtc の段取りを除く)。 */
  relayed = new Map<string, number>();

  join(info: PeerInfo): SignalingTransport {
    const m: Member = { info, handlers: new Map(), peersCb: () => {} };
    this.members.push(m);
    const sync = () => {
      const peers = this.members.map((x) => x.info);
      for (const x of this.members) x.peersCb(peers);
    };
    queueMicrotask(sync);
    return {
      send: async (event, payload) => {
        if (event !== "rtc") this.relayed.set(event, (this.relayed.get(event) ?? 0) + 1);
        for (const other of this.members) {
          if (other === m) continue;
          for (const cb of other.handlers.get(event) ?? []) cb(structuredClone(payload));
        }
        return true;
      },
      onBroadcast: (event, cb) => {
        const list = m.handlers.get(event) ?? [];
        list.push(cb);
        m.handlers.set(event, list);
      },
      onPresenceSync: () => {},
      onPeers: (cb) => {
        m.peersCb = cb;
      },
      close: async () => {
        this.members = this.members.filter((x) => x !== m);
        sync();
      },
    };
  }
}

function setup(opts?: { blocked?: boolean; guests?: number; legacyGuest?: boolean }) {
  const net = new FakeNet();
  net.blocked = !!opts?.blocked;
  const relay = new FakeRelay();
  const status = new Map<string, LinkStatus>();
  const make = (id: string, role: "host" | "guest", p2p = true) =>
    createHybridTransport(relay.join({ id, name: id, role }), {
      selfId: id,
      role,
      createPeerConnection: p2p ? () => new FakePc(net) : undefined,
      connectTimeoutMs: 40,
      retryMs: 10_000,
      onStatus: (s) => status.set(id, s),
    });
  const host = make("host", "host");
  const guests = Array.from({ length: opts?.guests ?? 1 }, (_, i) =>
    make(`g${i + 1}`, "guest", !(opts?.legacyGuest && i === 0)),
  );
  return { net, relay, status, host, guests };
}

function collect(t: { onBroadcast: (e: string, cb: (p: unknown) => void) => void }, event: string) {
  const got: unknown[] = [];
  t.onBroadcast(event, (p) => got.push(p));
  return got;
}

describe("utf8Length", () => {
  it("日本語・絵文字のバイト数を数える", () => {
    expect(utf8Length("abc")).toBe(3);
    expect(utf8Length("卓")).toBe(3);
    expect(utf8Length("é")).toBe(2);
    expect(utf8Length("🎲")).toBe(4);
  });
});

describe("createHybridTransport", () => {
  it("GM と参加者が直結し、以後は中継を使わない", async () => {
    const { relay, status, host, guests } = setup();
    const atGuest = collect(guests[0], "chunk");
    const atHost = collect(host, "chunk");
    await sleep(30);
    expect(status.get("host")!.peers).toEqual([{ id: "g1", name: "g1", link: "p2p" }]);
    expect(status.get("g1")!.peers[0].link).toBe("p2p");

    expect(await host.send("chunk", { n: 1 })).toBe(true);
    expect(await guests[0].send("chunk", { n: 2 })).toBe(true);
    await sleep(5);
    expect(atGuest).toEqual([{ n: 1 }]);
    expect(atHost).toEqual([{ n: 2 }]);
    expect(relay.relayed.get("chunk") ?? 0).toBe(0);
  });

  it("直結できない環境では中継に切り替えて届ける", async () => {
    const { relay, status, host, guests } = setup({ blocked: true });
    const atGuest = collect(guests[0], "chunk");
    await sleep(80);
    expect(status.get("g1")!.peers[0].link).toBe("relay");
    await host.send("chunk", { n: 1 });
    await sleep(5);
    expect(atGuest).toEqual([{ n: 1 }]);
    expect(relay.relayed.get("chunk")).toBe(1);
  });

  it("参加者のドラッグは GM が他の参加者へ配り直す(送り主には戻さない)", async () => {
    const { host, guests } = setup({ guests: 2 });
    const at1 = collect(guests[0], "live");
    const at2 = collect(guests[1], "live");
    const atHost = collect(host, "live");
    await sleep(30);
    await guests[0].send("live", { kind: "drag", panelId: "a", x: 0.1, y: 0.2 });
    await sleep(10);
    expect(atHost).toEqual([{ kind: "drag", panelId: "a", x: 0.1, y: 0.2 }]);
    expect(at2).toEqual([{ kind: "drag", panelId: "a", x: 0.1, y: 0.2, _src: "g1" }]);
    expect(at1).toEqual([]);
  });

  it("P2P を知らない旧版の参加者が居ても中継で届く", async () => {
    const { host, guests } = setup({ guests: 2, legacyGuest: true });
    const atLegacy = collect(guests[0], "chunk");
    const atNew = collect(guests[1], "chunk");
    await sleep(80);
    await host.send("chunk", { n: 1 });
    await sleep(5);
    expect(atLegacy).toEqual([{ n: 1 }]);
    // 新版は直結と中継の両方から受け取り得る(createRoom が id で重複を捨てる)
    expect(atNew.length).toBeGreaterThanOrEqual(1);
  });

  it("createRoom を載せても、直結越しに同期メッセージが 1 回だけ届く", async () => {
    const { host, guests } = setup({ guests: 2, legacyGuest: true });
    const gm = createRoom(host, { code: "ABC", selfId: "host" });
    const pl = createRoom(guests[1], { code: "ABC", selfId: "g2" });
    const got: NetMsg[] = [];
    pl.onMessage((m) => got.push(m));
    await sleep(80);
    await gm.send({ type: "telop", text: "第一章" });
    await sleep(10);
    expect(got).toEqual([{ type: "telop", text: "第一章" }]);
  });
});

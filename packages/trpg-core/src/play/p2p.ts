import type { PeerInfo, RoomTransport } from "./net.js";

/**
 * P2P(WebRTC DataChannel)+ 中継(Supabase Realtime)のハイブリッド通信。
 *
 * 目的: 自前のゲームサーバーを持たず(維持費ゼロ)に、卓の同期を速くする。
 *
 *   - 形は「星形」: GM(host)と各参加者(guest)だけを直結する。参加者どうしは
 *     直結しない。参加者の IP アドレスが他の参加者へ渡らないようにするため
 *     (直結の相手は GM だけ)。
 *   - 直結の段取り(SDP の交換)は中継側の broadcast("rtc")で行う。STUN は
 *     無料の公開サーバー(Cloudflare / Google)を使い、TURN は使わない
 *     (有料プランで TURN を足せるよう iceServers は外から渡す)。
 *   - 直結できない相手(企業ネットワーク・対称型 NAT など)がいる間だけ、
 *     従来どおり中継(Supabase broadcast)でも送る。受信側は createRoom が
 *     メッセージ id で重複を捨てるので、両方から届いても二重にならない。
 *   - 旧版のアプリ(P2P を知らない)が混ざっても、直結が成立しないだけで中継で
 *     従来どおり動く。
 *
 * ブラウザの RTCPeerConnection はここでは new しない(@trpg/core をランタイム
 * 依存ゼロ・DOM 非依存に保つため)。呼び出し側が createPeerConnection で注入する。
 */

/* ===== 注入する WebRTC の最小形 ===== */

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface RtcDataChannelLike {
  readonly readyState: string;
  readonly bufferedAmount: number;
  bufferedAmountLowThreshold: number;
  onopen: ((ev: any) => void) | null; // eslint-disable-line @typescript-eslint/no-explicit-any
  onclose: ((ev: any) => void) | null; // eslint-disable-line @typescript-eslint/no-explicit-any
  onmessage: ((ev: any) => void) | null; // eslint-disable-line @typescript-eslint/no-explicit-any
  onbufferedamountlow: ((ev: any) => void) | null; // eslint-disable-line @typescript-eslint/no-explicit-any
  send(data: string): void;
  close(): void;
}

export interface RtcSessionDescriptionLike {
  type: string;
  sdp?: string;
}

export interface RtcPeerConnectionLike {
  readonly connectionState: string;
  readonly iceGatheringState: string;
  readonly localDescription: RtcSessionDescriptionLike | null;
  readonly sctp?: { readonly maxMessageSize: number } | null;
  onicegatheringstatechange: ((ev: any) => void) | null; // eslint-disable-line @typescript-eslint/no-explicit-any
  onconnectionstatechange: ((ev: any) => void) | null; // eslint-disable-line @typescript-eslint/no-explicit-any
  ondatachannel: ((ev: { channel: RtcDataChannelLike }) => void) | null;
  createDataChannel(
    label: string,
    init?: { ordered?: boolean },
  ): RtcDataChannelLike;
  createOffer(): Promise<RtcSessionDescriptionLike>;
  createAnswer(): Promise<RtcSessionDescriptionLike>;
  setLocalDescription(d: RtcSessionDescriptionLike): Promise<void>;
  setRemoteDescription(d: RtcSessionDescriptionLike): Promise<void>;
  close(): void;
}

export interface PeerConnectionConfig {
  iceServers: IceServerConfig[];
  iceTransportPolicy?: "all" | "relay";
}

/** 無料・無制限の公開 STUN。TURN(中継サーバー)は含まない。 */
export const DEFAULT_ICE_SERVERS: IceServerConfig[] = [
  { urls: "stun:stun.cloudflare.com:3478" },
  { urls: "stun:stun.l.google.com:19302" },
];

/* ===== 中継側(シグナリング)に求める形 ===== */

/** 中継トランスポート + presence から参加者 id を知る口。 */
export interface SignalingTransport extends RoomTransport {
  onPeers(cb: (peers: PeerInfo[]) => void): void;
}

/* ===== 状態 ===== */

export type LinkKind = "p2p" | "connecting" | "relay";

export interface LinkStatus {
  /** 直結の相手ごとの状態(host なら参加者全員、guest なら GM だけ)。 */
  peers: { id: string; name: string; link: LinkKind }[];
  /** P2P を使っていない(利用者の設定 or WebRTC 非対応)。 */
  relayOnly: boolean;
}

export interface HybridOptions {
  selfId: string;
  role: "host" | "guest";
  iceServers?: IceServerConfig[];
  /** "relay" にすると TURN 経由だけで繋ぐ(相手に IP アドレスを見せない。TURN 必須)。 */
  iceTransportPolicy?: "all" | "relay";
  /** 未指定なら P2P を使わず中継だけで動く(旧来の挙動)。 */
  createPeerConnection?: (config: PeerConnectionConfig) => RtcPeerConnectionLike;
  /** guest → host で受けたとき、他の guest へ配り直すイベント(既定: ドラッグ中の座標)。 */
  forwardEvents?: string[];
  /** 直結が確立するまで待つ時間。過ぎたら中継に切り替えて後で再挑戦。 */
  connectTimeoutMs?: number;
  /** ICE 候補の収集を待つ上限(候補をまとめて 1 通で送るため)。 */
  gatherTimeoutMs?: number;
  /** 再挑戦の初回間隔(以後倍々、上限 2 分)。 */
  retryMs?: number;
  /** 再挑戦の上限回数。 */
  maxAttempts?: number;
  onStatus?: (s: LinkStatus) => void;
  log?: (line: string) => void;
}

interface Link {
  peerId: string;
  pc: RtcPeerConnectionLike;
  dc: RtcDataChannelLike | null;
  kind: LinkKind;
  timer?: ReturnType<typeof setTimeout>;
}

interface Frame {
  e: string;
  p: unknown;
}

interface RtcSignal {
  from: string;
  to: string;
  kind: "offer" | "answer";
  sdp: string;
}

const RTC_EVENT = "rtc";
/**
 * host が中継で何か受け取ってからこの間は、host の送信を中継にも流す。
 * presence が届く前に hello を送ってきた新規参加者や、P2P を知らない旧版の
 * 参加者を取りこぼさないため。
 */
const RELAY_ACTIVE_MS = 15_000;
const HIGH_WATER = 1024 * 1024;
const LOW_WATER = 256 * 1024;

/** UTF-8 でのバイト数(DataChannel の 1 メッセージ上限との比較用)。 */
export function utf8Length(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      n += 4;
      i++;
    } else n += 3;
  }
  return n;
}

export function createHybridTransport(
  signal: SignalingTransport,
  opts: HybridOptions,
): RoomTransport {
  const { selfId, role } = opts;
  const log = opts.log ?? (() => {});
  const forward = new Set(opts.forwardEvents ?? ["live"]);
  const connectTimeout = opts.connectTimeoutMs ?? 10_000;
  const gatherTimeout = opts.gatherTimeoutMs ?? 2_500;
  const retryBase = opts.retryMs ?? 15_000;
  const maxAttempts = opts.maxAttempts ?? 4;
  const iceServers = opts.iceServers ?? DEFAULT_ICE_SERVERS;
  const p2pEnabled = !!opts.createPeerConnection;

  const handlers = new Map<string, Array<(payload: unknown) => void>>();
  const relayHooked = new Set<string>();
  let peers: PeerInfo[] = [];
  let presenceIds = new Set<string>();
  // host: 参加者を初めて見た時刻。申し込みが来ないまま時間が経った相手は
  // (P2P を切っている / 旧版のアプリ)「中継」と表示する。
  const firstSeen = new Map<string, number>();
  let lastRelayRx = -Infinity;
  const links = new Map<string, Link>();
  const attempts = new Map<string, number>();
  const retryAt = new Map<string, ReturnType<typeof setTimeout>>();
  let closed = false;

  /** 直結する相手(host: 参加者全員 / guest: GM だけ)。 */
  function targets(): PeerInfo[] {
    if (role === "host") return peers.filter((p) => p.id !== selfId && p.role !== "host");
    return peers.filter((p) => p.id !== selfId && p.role === "host").slice(0, 1);
  }

  function emitStatus() {
    opts.onStatus?.({
      relayOnly: !p2pEnabled,
      peers: targets().map((p) => ({
        id: p.id,
        name: p.name,
        link:
          links.get(p.id)?.kind ??
          (p2pEnabled &&
          Date.now() - (firstSeen.get(p.id) ?? Date.now()) < connectTimeout
            ? "connecting"
            : "relay"),
      })),
    });
  }

  function dispatch(event: string, payload: unknown) {
    const src =
      payload && typeof payload === "object"
        ? (payload as { _src?: unknown })._src
        : undefined;
    if (src === selfId) return; // 自分の送ったものが転送で戻ってきた
    for (const cb of handlers.get(event) ?? []) cb(payload);
  }

  function hookRelay(event: string) {
    if (relayHooked.has(event)) return;
    relayHooked.add(event);
    signal.onBroadcast(event, (payload) => {
      if (role === "host") lastRelayRx = Date.now();
      dispatch(event, payload);
    });
  }

  /* ----- リンクの張り替え ----- */

  function dropLink(peerId: string, kind: LinkKind = "relay") {
    const l = links.get(peerId);
    if (!l) return;
    if (l.timer) clearTimeout(l.timer);
    l.kind = kind;
    l.dc = null;
    try {
      l.pc.close();
    } catch {
      /* noop */
    }
    emitStatus();
  }

  function scheduleRetry(peerId: string) {
    if (closed || role !== "guest") return; // 直結は guest から申し込む
    const n = (attempts.get(peerId) ?? 0) + 1;
    attempts.set(peerId, n);
    if (n >= maxAttempts) {
      log(`[p2p] ${peerId}: 直結をあきらめて中継で続けます`);
      return;
    }
    const wait = Math.min(retryBase * 2 ** (n - 1), 120_000);
    clearTimeout(retryAt.get(peerId));
    retryAt.set(
      peerId,
      setTimeout(() => {
        retryAt.delete(peerId);
        if (!closed && targets().some((p) => p.id === peerId)) void dial(peerId);
      }, wait),
    );
  }

  function newPc(): RtcPeerConnectionLike {
    return opts.createPeerConnection!({
      iceServers,
      ...(opts.iceTransportPolicy ? { iceTransportPolicy: opts.iceTransportPolicy } : {}),
    });
  }

  function watch(link: Link) {
    const { pc } = link;
    pc.onconnectionstatechange = () => {
      if (links.get(link.peerId) !== link) return;
      const st = pc.connectionState;
      if (st === "failed" || st === "closed") {
        log(`[p2p] ${link.peerId}: ${st} → 中継へ`);
        dropLink(link.peerId);
        scheduleRetry(link.peerId);
      }
    };
    link.timer = setTimeout(() => {
      if (links.get(link.peerId) !== link || link.kind === "p2p") return;
      log(`[p2p] ${link.peerId}: 直結できず(タイムアウト)→ 中継へ`);
      dropLink(link.peerId);
      scheduleRetry(link.peerId);
    }, connectTimeout);
  }

  function attachChannel(link: Link, dc: RtcDataChannelLike) {
    dc.bufferedAmountLowThreshold = LOW_WATER;
    dc.onopen = () => {
      if (links.get(link.peerId) !== link) return;
      link.dc = dc;
      link.kind = "p2p";
      if (link.timer) clearTimeout(link.timer);
      attempts.delete(link.peerId);
      log(`[p2p] ${link.peerId}: 直結しました`);
      emitStatus();
    };
    dc.onclose = () => {
      if (links.get(link.peerId) !== link) return;
      dropLink(link.peerId);
      scheduleRetry(link.peerId);
    };
    dc.onmessage = (ev: { data: unknown }) => {
      if (typeof ev.data !== "string") return;
      let f: Frame;
      try {
        f = JSON.parse(ev.data) as Frame;
      } catch {
        return;
      }
      if (!f || typeof f.e !== "string") return;
      dispatch(f.e, f.p);
      if (role === "host" && forward.has(f.e)) relayFromGuest(link.peerId, f);
    };
    if (dc.readyState === "open") dc.onopen?.({});
  }

  async function waitGathering(pc: RtcPeerConnectionLike) {
    if (pc.iceGatheringState === "complete") return;
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, gatherTimeout);
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === "complete") {
          clearTimeout(t);
          resolve();
        }
      };
    });
  }

  /** guest → host へ直結を申し込む。 */
  async function dial(peerId: string) {
    if (closed || !p2pEnabled) return;
    const old = links.get(peerId);
    if (old && (old.kind === "p2p" || old.kind === "connecting")) return;
    const pc = newPc();
    const link: Link = { peerId, pc, dc: null, kind: "connecting" };
    links.set(peerId, link);
    emitStatus();
    watch(link);
    attachChannel(link, pc.createDataChannel("room", { ordered: true }));
    try {
      await pc.setLocalDescription(await pc.createOffer());
      await waitGathering(pc);
      if (links.get(peerId) !== link || !pc.localDescription?.sdp) return;
      await signal.send(RTC_EVENT, {
        from: selfId,
        to: peerId,
        kind: "offer",
        sdp: pc.localDescription.sdp,
      } satisfies RtcSignal);
    } catch (e) {
      log(`[p2p] 申し込みに失敗: ${String(e)}`);
      dropLink(peerId);
      scheduleRetry(peerId);
    }
  }

  /** host: 申し込みに応える。 */
  async function answer(sig: RtcSignal) {
    if (closed || !p2pEnabled) return;
    if (!targets().some((p) => p.id === sig.from)) {
      // presence がまだ届いていない参加者。名前は後で presence が埋める。
      peers = [...peers, { id: sig.from, name: "", role: "guest" }];
    }
    const old = links.get(sig.from);
    if (old) dropLink(sig.from); // 張り直し(相手が再接続した)
    const pc = newPc();
    const link: Link = { peerId: sig.from, pc, dc: null, kind: "connecting" };
    links.set(sig.from, link);
    emitStatus();
    watch(link);
    pc.ondatachannel = (ev) => attachChannel(link, ev.channel);
    try {
      await pc.setRemoteDescription({ type: "offer", sdp: sig.sdp });
      await pc.setLocalDescription(await pc.createAnswer());
      await waitGathering(pc);
      if (links.get(sig.from) !== link || !pc.localDescription?.sdp) return;
      await signal.send(RTC_EVENT, {
        from: selfId,
        to: sig.from,
        kind: "answer",
        sdp: pc.localDescription.sdp,
      } satisfies RtcSignal);
    } catch (e) {
      log(`[p2p] 応答に失敗: ${String(e)}`);
      dropLink(sig.from);
    }
  }

  signal.onBroadcast(RTC_EVENT, (payload) => {
    const sig = payload as RtcSignal;
    if (!sig || sig.to !== selfId) return;
    if (sig.kind === "offer" && role === "host") void answer(sig);
    if (sig.kind === "answer" && role === "guest") {
      const link = links.get(sig.from);
      if (!link || link.kind !== "connecting") return;
      link.pc
        .setRemoteDescription({ type: "answer", sdp: sig.sdp })
        .catch((e) => {
          log(`[p2p] 応答の適用に失敗: ${String(e)}`);
          dropLink(sig.from);
          scheduleRetry(sig.from);
        });
    }
  });

  signal.onPeers((list) => {
    // presence より先に申し込みが届いた相手(peers に仮登録)は残しておく。
    const pending = peers.filter(
      (p) => !presenceIds.has(p.id) && links.has(p.id) && !list.some((q) => q.id === p.id),
    );
    peers = [...list, ...pending];
    const ids = new Set(list.map((p) => p.id));
    // presence から居なくなった相手のリンクを片付ける。
    for (const id of [...links.keys()]) {
      if (presenceIds.has(id) && !ids.has(id)) {
        dropLink(id);
        links.delete(id);
        attempts.delete(id);
        clearTimeout(retryAt.get(id));
        retryAt.delete(id);
        peers = peers.filter((p) => p.id !== id);
      }
    }
    presenceIds = ids;
    if (role === "host") {
      for (const p of targets()) {
        if (firstSeen.has(p.id)) continue;
        firstSeen.set(p.id, Date.now());
        // 申し込みが来なければ、待ち時間が過ぎた時点で表示を「中継」に改める。
        setTimeout(() => !closed && emitStatus(), connectTimeout + 50);
      }
      for (const id of [...firstSeen.keys()]) if (!ids.has(id)) firstSeen.delete(id);
    }
    if (role === "guest" && p2pEnabled) {
      for (const p of targets()) {
        if (!links.has(p.id) && !retryAt.has(p.id)) void dial(p.id);
      }
    }
    emitStatus();
  });

  /* ----- 送信 ----- */

  async function sendOnChannel(dc: RtcDataChannelLike, text: string) {
    if (dc.bufferedAmount > HIGH_WATER) {
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, 3000);
        dc.onbufferedamountlow = () => {
          clearTimeout(t);
          dc.onbufferedamountlow = null;
          resolve();
        };
      });
    }
    dc.send(text);
  }

  function maxSize(link: Link): number {
    return link.pc.sctp?.maxMessageSize || 65_536;
  }

  /**
   * 指定の相手へ直結で送る。直結できなかった相手が居れば true(=中継も要る)。
   */
  async function sendDirect(
    to: PeerInfo[],
    text: string,
  ): Promise<{ needRelay: boolean; ok: boolean }> {
    let needRelay = false;
    let ok = true;
    const bytes = utf8Length(text);
    await Promise.all(
      to.map(async (p) => {
        const link = links.get(p.id);
        if (!link || link.kind !== "p2p" || !link.dc || bytes > maxSize(link)) {
          needRelay = true;
          return;
        }
        try {
          await sendOnChannel(link.dc, text);
        } catch {
          ok = false;
          needRelay = true;
          dropLink(p.id);
          scheduleRetry(p.id);
        }
      }),
    );
    return { needRelay, ok };
  }

  /** host: 参加者から届いたもの(ドラッグ等)を他の参加者へ配り直す。 */
  function relayFromGuest(fromId: string, f: Frame) {
    const payload =
      f.p && typeof f.p === "object" ? { ...(f.p as object), _src: fromId } : f.p;
    const others = targets().filter((p) => p.id !== fromId);
    void sendDirect(others, JSON.stringify({ e: f.e, p: payload })).then(
      ({ needRelay }) => {
        if (needRelay) void signal.send(f.e, payload);
      },
    );
  }

  return {
    async send(event, payload) {
      const to = targets();
      if (!p2pEnabled || to.length === 0) return signal.send(event, payload);
      const { needRelay } = await sendDirect(
        to,
        JSON.stringify({ e: event, p: payload } satisfies Frame),
      );
      const relayActive =
        role === "host" && Date.now() - lastRelayRx < RELAY_ACTIVE_MS;
      return needRelay || relayActive ? signal.send(event, payload) : true;
    },
    onBroadcast(event, cb) {
      const list = handlers.get(event) ?? [];
      list.push(cb);
      handlers.set(event, list);
      hookRelay(event);
    },
    onPresenceSync(cb) {
      signal.onPresenceSync(cb);
    },
    async close() {
      closed = true;
      for (const t of retryAt.values()) clearTimeout(t);
      for (const id of [...links.keys()]) dropLink(id);
      links.clear();
      await signal.close();
    },
  };
}

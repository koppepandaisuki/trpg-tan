import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  createHybridTransport,
  createRoom,
  roomTopic,
  DEFAULT_ICE_SERVERS,
  type IceServerConfig,
  type LinkStatus,
  type PeerInfo,
  type Room,
  type RtcPeerConnectionLike,
  type SignalingTransport,
  type NetMsg,
} from "@trpg/core";
import { createClient } from "@/lib/supabase/client";

/**
 * Web 版 PLAY の通信アダプタ。
 *
 * プロトコル本体(チャンク分割・ack 再送・逐次キュー・進捗)は `@trpg/core` の
 * createRoom、P2P 直結は createHybridTransport が持つ。デスクトップ版
 * (apps/desktop/src/net.ts)と **同じ core を別アダプタで使う** ので、
 * Web ⇄ デスクトップ間でも卓に相互参加できる(プロトコルのドリフトが起きない)。
 *
 * 経路:
 *   - GM ⇔ 参加者は WebRTC で直結(サーバーを経由しない = 速い・維持費 0 円)
 *   - 直結の段取り・presence・直結できない相手への送信は Supabase Realtime
 */

export { makeRoomCode } from "@trpg/core";
export type { Room, NetMsg, NetIntent, LiveMsg, LinkStatus } from "@trpg/core";

const P2P_PREF_KEY = "redice.play.p2p";

/**
 * 利用者の設定: P2P 直結を使うか(既定: 使う)。
 * 使わない = 相手に IP アドレスを知らせない代わりに、すべて中継で送る(少し遅い)。
 */
export function readP2pPreference(): boolean {
  try {
    return localStorage.getItem(P2P_PREF_KEY) !== "off";
  } catch {
    return true;
  }
}

export function writeP2pPreference(on: boolean): void {
  try {
    localStorage.setItem(P2P_PREF_KEY, on ? "on" : "off");
  } catch {
    // 保存できない環境(プライベートモード等)は今回だけの設定になる
  }
}

/** ICE サーバー(STUN / 有料プランなら TURN)をサーバーからもらう。失敗時は公開 STUN。 */
async function fetchIceServers(): Promise<IceServerConfig[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);
  try {
    const res = await fetch("/api/play/ice", {
      cache: "no-store",
      signal: ctrl.signal,
    });
    const body = (await res.json()) as { iceServers?: IceServerConfig[] };
    return body.iceServers && body.iceServers.length > 0
      ? body.iceServers
      : DEFAULT_ICE_SERVERS;
  } catch {
    return DEFAULT_ICE_SERVERS;
  } finally {
    clearTimeout(timer);
  }
}

export interface ConnectOptions {
  /** 送信直前の変換(メディアを Storage URL に差し替える等)。 */
  transform?: (msg: NetMsg) => Promise<NetMsg>;
  /** 卓を開いた側(GM)は "host"。参加者は "guest"(既定)。 */
  role?: "host" | "guest";
  /** 直結の状態(誰と直結 / 中継か)。接続状況の表示に使う。 */
  onLinkStatus?: (s: LinkStatus) => void;
}

/** ルームに接続する(GM/参加者 共通)。subscribe 完了で resolve。 */
export async function connectRoom(
  code: string,
  displayName: string,
  opts?: ConnectOptions,
): Promise<Room> {
  const supabase = createClient();
  const topic = roomTopic(code);
  const role = opts?.role ?? "guest";

  // 再接続・再マウントで同 topic の古いチャンネルが残っていると、
  // subscribe 済みチャンネルが再利用されて presence コールバックを追加できず
  // 接続に失敗する。先に撤去してから作り直す(デスクトップ版と同じ対処)。
  const stale = supabase
    .getChannels()
    .filter((ch) => ch.topic === `realtime:${topic}`);
  if (stale.length > 0) {
    await Promise.all(stale.map((ch) => supabase.removeChannel(ch)));
  }

  const p2p =
    readP2pPreference() && typeof globalThis.RTCPeerConnection === "function";
  const iceServers = p2p ? await fetchIceServers() : DEFAULT_ICE_SERVERS;

  const selfId = crypto.randomUUID();
  const channel: RealtimeChannel = supabase.channel(topic, {
    // ack: true でチャンク毎にサーバ確認 → 自然にペーシングされ確実に届く。
    config: { broadcast: { self: false, ack: true }, presence: { key: selfId } },
  });

  type Meta = { name?: string; role?: "host" | "guest" };
  let onPresenceSync: (names: string[]) => void = () => {};
  let onPeers: (peers: PeerInfo[]) => void = () => {};
  channel.on("presence", { event: "sync" }, () => {
    const state = channel.presenceState<Meta>();
    const peers: PeerInfo[] = Object.entries(state).map(([id, metas]) => ({
      id,
      name: metas[0]?.name ?? "",
      role: metas[0]?.role,
    }));
    onPresenceSync(peers.map((p) => p.name).filter(Boolean));
    onPeers(peers);
  });

  const signal: SignalingTransport = {
    send: async (event, payload) => {
      const res = await channel.send({ type: "broadcast", event, payload });
      return res === "ok";
    },
    onBroadcast: (event, cb) => {
      channel.on("broadcast", { event }, ({ payload }) => cb(payload));
    },
    onPresenceSync: (cb) => {
      onPresenceSync = cb;
    },
    onPeers: (cb) => {
      onPeers = cb;
    },
    close: async () => {
      await supabase.removeChannel(channel);
    },
  };

  const transport = createHybridTransport(signal, {
    selfId,
    role,
    iceServers,
    createPeerConnection: p2p
      ? (config) =>
          new RTCPeerConnection(config) as unknown as RtcPeerConnectionLike
      : undefined,
    onStatus: opts?.onLinkStatus,
    log: (line) => console.info(line),
  });

  // createRoom は購読(on)を subscribe 前に登録する必要があるので、先に作る。
  const room = createRoom(transport, {
    code,
    selfId,
    transform: opts?.transform,
  });

  return new Promise<Room>((resolve, reject) => {
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void channel.track({ name: displayName, role } satisfies Meta);
        resolve(room);
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        void supabase.removeChannel(channel);
        reject(new Error(`接続できませんでした(${status})`));
      }
    });
  });
}

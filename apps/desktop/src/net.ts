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
  type Signer,
} from "@trpg/core";
import { supabase } from "./supabase";
import { appFetch, WEB_BASE } from "./platform";

/**
 * ネットワーク同期の Supabase Realtime アダプタ。
 *
 * プロトコル本体(チャンク分割・ack 再送・逐次キュー・進捗)は
 * `@trpg/core` の createRoom が持つ。ここは「Supabase の channel を用意して
 * RoomTransport に被せる」だけの薄い層で、Web(Next.js)側も同じ core を
 * 別アダプタで使う(= プロトコルのドリフトが起きない)。
 */

export {
  makeRoomCode,
  type Room,
  type NetMsg,
  type NetIntent,
  type LiveMsg,
  type LinkStatus,
} from "@trpg/core";

const P2P_PREF_KEY = "redice.play.p2p";

/**
 * 利用者の設定: P2P 直結を使うか(既定: 使う)。Web 版と同じキー。
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
    // 保存できない環境は今回だけの設定になる
  }
}

/** ICE サーバー(STUN / 有料プランなら TURN)を Web API からもらう。失敗時は公開 STUN。 */
async function fetchIceServers(): Promise<IceServerConfig[]> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const res = await Promise.race([
      appFetch(`${WEB_BASE}/api/play/ice`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000)),
    ]);
    const body = (await res.json()) as { iceServers?: IceServerConfig[] };
    return body.iceServers && body.iceServers.length > 0
      ? body.iceServers
      : DEFAULT_ICE_SERVERS;
  } catch {
    return DEFAULT_ICE_SERVERS;
  }
}

/** ルームに接続する(GM/参加者 共通)。subscribe 完了で resolve。 */
export async function connectRoom(
  code: string,
  displayName: string,
  opts?: {
    /**
     * 送信直前にメッセージを変換する(GM がメディアを Storage の URL に差し替える
     * のに使う)。変換は送信キュー内で行うので逐次・確実。
     */
    transform?: Parameters<typeof createRoom>[1]["transform"];
    /** 卓を開いた側(GM)は "host"。参加者は "guest"(既定)。 */
    role?: "host" | "guest";
    /** 直結の状態(誰と直結 / 中継か)。 */
    onLinkStatus?: (s: LinkStatus) => void;
    /** 送るメッセージに署名する鍵(なりすまし対策。@trpg/core auth.ts)。 */
    signer?: Signer;
  },
): Promise<Room> {
  const topic = roomTopic(code);
  const role = opts?.role ?? "guest";
  const p2p =
    readP2pPreference() && typeof globalThis.RTCPeerConnection === "function";
  const iceServers = p2p ? await fetchIceServers() : DEFAULT_ICE_SERVERS;

  // 再接続 / 再試行 / 再マウントで同名チャンネルが残っていると、supabase.channel()
  // は同 topic の既存チャンネルを“再利用”する。それが既に subscribe 済み
  // (joined/joining)だと、続く channel.on("presence", …) が
  //   「cannot add `presence` callbacks … after `subscribe()`.」
  // を投げて接続に失敗する。先に同 topic の古いチャンネルを確実に撤去してから
  // 作り直す(unsubscribe → close で内部リストからも外れる)。
  const stale = supabase
    .getChannels()
    .filter((ch) => ch.topic === `realtime:${topic}`);
  if (stale.length > 0) {
    await Promise.all(stale.map((ch) => supabase.removeChannel(ch)));
  }

  const selfId = crypto.randomUUID();
  const channel: RealtimeChannel = supabase.channel(topic, {
    // ack: true が重要。これが無いと channel.send() はサーバ応答を待たず即
    // 'ok' を返すため、await しても実際には待たず、スナップショット(画像入りで
    // 数 MB → 多数のチャンク)を一気にバースト送信してサーバ側で取りこぼされ、
    // 参加者が「卓データ待ち」のまま固まる。ack でチャンク毎に確認 → 自然に
    // ペーシングされ、確実に届く。
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

  // GM ⇔ 参加者を WebRTC で直結(サーバーを経由しない)。直結できない相手には
  // 上の Supabase 中継で送る(@trpg/core p2p.ts)。
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
  const room = createRoom(transport, {
    code,
    selfId,
    transform: opts?.transform,
    signer: opts?.signer,
    log: (line) => console.info(line),
  });

  return new Promise<Room>((resolve, reject) => {
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void channel.track({ name: displayName, role } satisfies Meta);
        // 計測: 接続先プロジェクト + ack 往復(≒ネットワーク遅延=リージョンの近さ)。
        // ~50ms=近い(Tokyo 等) / ~200ms=遠い。大きいほど直列送信が遅くなる。
        console.info(
          `[net.project] ${import.meta.env.VITE_SUPABASE_URL ?? "(env未設定)"}`,
        );
        void (async () => {
          const t0 = performance.now();
          try {
            await channel.send({ type: "broadcast", event: "ping", payload: {} });
            console.info(`[net.rtt] ack ~${Math.round(performance.now() - t0)}ms`);
          } catch {
            // 無視
          }
        })();
        resolve(room);
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        // 失敗チャンネルを残すと次の接続で再利用され同じ不具合を招く。撤去する。
        void supabase.removeChannel(channel);
        reject(new Error(`接続できませんでした(${status})`));
      }
    });
  });
}

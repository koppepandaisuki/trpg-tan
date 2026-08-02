import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  createRoom,
  roomTopic,
  type Room,
  type RoomTransport,
} from "@trpg/core";
import { supabase } from "./supabase";

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
} from "@trpg/core";

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
  },
): Promise<Room> {
  const topic = roomTopic(code);

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

  let onPresenceSync: (names: string[]) => void = () => {};
  channel.on("presence", { event: "sync" }, () => {
    const state = channel.presenceState<{ name: string }>();
    const names = Object.values(state)
      .flat()
      .map((m) => m.name)
      .filter(Boolean);
    onPresenceSync(names);
  });

  const transport: RoomTransport = {
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
    close: async () => {
      await supabase.removeChannel(channel);
    },
  };

  return new Promise<Room>((resolve, reject) => {
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void channel.track({ name: displayName });
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
        resolve(
          createRoom(transport, {
            code,
            selfId,
            transform: opts?.transform,
            log: (line) => console.info(line),
          }),
        );
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        // 失敗チャンネルを残すと次の接続で再利用され同じ不具合を招く。撤去する。
        void supabase.removeChannel(channel);
        reject(new Error(`接続できませんでした(${status})`));
      }
    });
  });
}

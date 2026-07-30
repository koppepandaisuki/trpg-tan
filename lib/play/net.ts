import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  createRoom,
  roomTopic,
  type Room,
  type RoomTransport,
  type NetMsg,
} from "@trpg/core";
import { createClient } from "@/lib/supabase/client";

/**
 * Web 版 PLAY の Supabase Realtime アダプタ。
 *
 * プロトコル本体(チャンク分割・ack 再送・逐次キュー・進捗)は
 * `@trpg/core` の createRoom が持つ。デスクトップ版(apps/desktop/src/net.ts)
 * と **同じ core を別アダプタで使う** ので、Web ⇄ デスクトップ間でも卓に
 * 相互参加できる(プロトコルのドリフトが起きない)。
 */

export { makeRoomCode } from "@trpg/core";
export type { Room, NetMsg, NetIntent, LiveMsg } from "@trpg/core";

/** ルームに接続する(GM/参加者 共通)。subscribe 完了で resolve。 */
export async function connectRoom(
  code: string,
  displayName: string,
  opts?: {
    /** 送信直前の変換(メディアを Storage URL に差し替える等)。 */
    transform?: (msg: NetMsg) => Promise<NetMsg>;
  },
): Promise<Room> {
  const supabase = createClient();
  const topic = roomTopic(code);

  // 再接続・再マウントで同 topic の古いチャンネルが残っていると、
  // subscribe 済みチャンネルが再利用されて presence コールバックを追加できず
  // 接続に失敗する。先に撤去してから作り直す(デスクトップ版と同じ対処)。
  const stale = supabase
    .getChannels()
    .filter((ch) => ch.topic === `realtime:${topic}`);
  if (stale.length > 0) {
    await Promise.all(stale.map((ch) => supabase.removeChannel(ch)));
  }

  const selfId = crypto.randomUUID();
  const channel: RealtimeChannel = supabase.channel(topic, {
    // ack: true でチャンク毎にサーバ確認 → 自然にペーシングされ確実に届く。
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
        resolve(
          createRoom(transport, {
            code,
            selfId,
            transform: opts?.transform,
          }),
        );
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        void supabase.removeChannel(channel);
        reject(new Error(`接続できませんでした(${status})`));
      }
    });
  });
}

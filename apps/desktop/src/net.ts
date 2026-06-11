import type { RealtimeChannel } from "@supabase/supabase-js";
import type { PlayEvent, PlayScene, CutIn } from "@trpg/core";
import { supabase } from "./supabase";

/**
 * ネットワーク同期(Supabase Realtime broadcast)。
 *
 * 設計はローカルと同じ「GM 権威のイベントソーシング」:
 *   - GM がルームを開き、確定済みイベント(PlayEvent)を配信する
 *   - 参加者はスナップショット + イベント列から同じ状態を再構成する(reduce)
 *   - 参加者の操作は intent として GM へ送り、GM が正規イベント化して配信
 *     (乱数は GM で消費 → 全員の出目が一致する)
 *
 * 画像(data URL)が大きいので、全メッセージを JSON 文字列のチャンク
 * (CHUNK 文字ずつ)に割って送る。Realtime のペイロード上限対策。
 */

const CHUNK = 60_000; // UTF-16 文字数。Realtime の上限(~256KB)に対して安全側。

export type NetMsg =
  | { type: "hello"; from: string; name: string }
  | { type: "snapshot"; scene: PlayScene }
  | { type: "event"; ev: PlayEvent }
  | { type: "intent"; from: string; intent: NetIntent }
  | { type: "cutin"; cutin: CutIn }
  | { type: "telop"; text: string }
  | { type: "memo"; text: string }
  | { type: "closed" };

/** 参加者 → GM の操作意図。GM が検証して正規イベント化する。 */
export type NetIntent =
  | {
      kind: "send";
      speakerId: string;
      raw: string;
      channel: string;
      secret: boolean;
      visibleTo: string[];
    }
  | { kind: "resource"; panelId: string; resourceKey: string; delta: number }
  | { kind: "move"; panelId: string; x: number; y: number }
  | { kind: "memo"; text: string }
  | {
      kind: "panel-update";
      panelId: string;
      patch: {
        name?: string;
        note?: string;
        palette?: string;
        speed?: number;
        portrait?: string | null;
        variants?: { id: string; label: string; image: string }[];
      };
    };

interface ChunkPayload {
  mid: string;
  i: number;
  n: number;
  data: string;
}

export interface Room {
  code: string;
  /** 自分の participant id。 */
  selfId: string;
  send: (msg: NetMsg) => void;
  onMessage: (cb: (msg: NetMsg) => void) => void;
  onPresence: (cb: (names: string[]) => void) => void;
  close: () => void;
}

/** 6 桁の参加コードを作る(紛らわしい文字は除外)。 */
export function makeRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

/** ルームに接続する(GM/参加者 共通)。subscribe 完了で resolve。 */
export function connectRoom(code: string, displayName: string): Promise<Room> {
  const selfId = crypto.randomUUID();
  const channel: RealtimeChannel = supabase.channel(`play_${code}`, {
    config: { broadcast: { self: false }, presence: { key: selfId } },
  });

  let onMsg: (msg: NetMsg) => void = () => {};
  let onPres: (names: string[]) => void = () => {};
  const buffers = new Map<string, { parts: string[]; got: number; n: number }>();

  channel.on("broadcast", { event: "chunk" }, ({ payload }) => {
    const c = payload as ChunkPayload;
    let buf = buffers.get(c.mid);
    if (!buf) {
      buf = { parts: new Array<string>(c.n).fill(""), got: 0, n: c.n };
      buffers.set(c.mid, buf);
    }
    if (buf.parts[c.i] === "") {
      buf.parts[c.i] = c.data;
      buf.got += 1;
    }
    if (buf.got === buf.n) {
      buffers.delete(c.mid);
      try {
        onMsg(JSON.parse(buf.parts.join("")) as NetMsg);
      } catch {
        // 壊れたメッセージは無視
      }
    }
  });

  channel.on("presence", { event: "sync" }, () => {
    const state = channel.presenceState<{ name: string }>();
    const names = Object.values(state)
      .flat()
      .map((m) => m.name)
      .filter(Boolean);
    onPres(names);
  });

  // 送信は 1 本のキューで逐次化する。スナップショット(画像入りで数 MB に
  // なり得る)のチャンクを一気に投げるとレート制限に当たるため。
  let sendQueue: Promise<void> = Promise.resolve();
  function send(msg: NetMsg) {
    const json = JSON.stringify(msg);
    const mid = crypto.randomUUID();
    const n = Math.max(1, Math.ceil(json.length / CHUNK));
    sendQueue = sendQueue.then(async () => {
      for (let i = 0; i < n; i++) {
        const payload: ChunkPayload = {
          mid,
          i,
          n,
          data: json.slice(i * CHUNK, (i + 1) * CHUNK),
        };
        try {
          await channel.send({ type: "broadcast", event: "chunk", payload });
        } catch {
          // 切断中などの送信失敗はメッセージ単位で諦める(後続は続行)。
          return;
        }
      }
    });
  }

  return new Promise((resolve, reject) => {
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void channel.track({ name: displayName });
        resolve({
          code,
          selfId,
          send,
          onMessage: (cb) => {
            onMsg = cb;
          },
          onPresence: (cb) => {
            onPres = cb;
          },
          close: () => {
            // 送信キューを掃いてから切断("closed" 通知の取りこぼし防止)。
            void sendQueue.then(() => supabase.removeChannel(channel));
          },
        });
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        reject(new Error(`接続できませんでした(${status})`));
      }
    });
  });
}

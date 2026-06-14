import type { RealtimeChannel } from "@supabase/supabase-js";
import type { PlayEvent, PlayScene, CutIn, Panel } from "@trpg/core";
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
  /** 参加者が自分のキャラを登場させる(GM が owner を刻んで panel-add)。 */
  | { kind: "add-char"; panel: Panel }
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
  /** メッセージ送信。全チャンクの送信完了で resolve(集約・逐次化に使える)。 */
  send: (msg: NetMsg) => Promise<void>;
  onMessage: (cb: (msg: NetMsg) => void) => void;
  onPresence: (cb: (names: string[]) => void) => void;
  /**
   * 複数チャンクに分かれた受信(スナップショット等)の進捗。received/total は
   * チャンク数。組み立て完了 or 受信が無いときは null。
   */
  onProgress: (cb: (p: { received: number; total: number } | null) => void) => void;
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
export async function connectRoom(
  code: string,
  displayName: string,
): Promise<Room> {
  const topic = `play_${code}`;

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

  let onMsg: (msg: NetMsg) => void = () => {};
  let onPres: (names: string[]) => void = () => {};
  let onProg: (p: { received: number; total: number } | null) => void = () => {};
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
    // 複数チャンクの大きい受信(スナップショット等)は進捗を通知する。
    if (buf.n > 1) onProg({ received: buf.got, total: buf.n });
    if (buf.got === buf.n) {
      buffers.delete(c.mid);
      if (buf.n > 1) onProg(null); // 完了
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
  // なり得る)のチャンクを一気に投げるとレート制限に当たるため。ack:true なので
  // channel.send() はサーバ確認まで待つ = 1 チャンクずつ確実に流れる。
  let sendQueue: Promise<void> = Promise.resolve();
  function send(msg: NetMsg): Promise<void> {
    const json = JSON.stringify(msg);
    const mid = crypto.randomUUID();
    const n = Math.max(1, Math.ceil(json.length / CHUNK));
    const task = sendQueue.then(async () => {
      for (let i = 0; i < n; i++) {
        const payload: ChunkPayload = {
          mid,
          i,
          n,
          data: json.slice(i * CHUNK, (i + 1) * CHUNK),
        };
        // 取りこぼし対策で数回まで再送(ack の戻りが 'ok' 以外なら失敗扱い)。
        let ok = false;
        for (let attempt = 0; attempt < 4 && !ok; attempt++) {
          try {
            const res = await channel.send({
              type: "broadcast",
              event: "chunk",
              payload,
            });
            ok = res === "ok";
          } catch {
            ok = false;
          }
          if (!ok) await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
        }
        if (!ok) return; // 数回試して駄目ならこのメッセージは諦める(後続は続行)
      }
    });
    // 次メッセージは前メッセージ完了後に流す。呼び出し側は task を await して
    // 「送り終わるまで次を積まない」集約ができる(スナップショット連投の防止)。
    sendQueue = task.catch(() => {});
    return task;
  }

  return new Promise<Room>((resolve, reject) => {
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
          onProgress: (cb) => {
            onProg = cb;
          },
          close: () => {
            // 送信キューを掃いてから切断("closed" 通知の取りこぼし防止)。
            void sendQueue.then(() => supabase.removeChannel(channel));
          },
        });
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        // 失敗チャンネルを残すと次の接続で再利用され同じ不具合を招く。撤去する。
        void supabase.removeChannel(channel);
        reject(new Error(`接続できませんでした(${status})`));
      }
    });
  });
}

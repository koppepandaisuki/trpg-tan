import type { RealtimeChannel } from "@supabase/supabase-js";
import type { PlayEvent, PlayScene, Panel } from "@trpg/core";
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
  /**
   * 権威スナップショット(状態置換)。GM の現在状態(秘匿駒を除いた scene)を丸ごと
   * 配信し、参加者は rev が進んだときだけ scene を置き換える。取りこぼしても次の
   * 配信で必ず収束する(イベント再生のような恒久ズレが起きない)。rev は単調増加で、
   * broadcast の順序逆転(古い state が新しい state を潰す)を防ぐ。
   */
  | { type: "state"; rev: number; scene: PlayScene }
  /** 即時イベント(チャット/ダイスのみ)。ログ即時表示＋ダイス演出用。状態は state が権威。 */
  | { type: "event"; ev: PlayEvent }
  | { type: "intent"; from: string; intent: NetIntent }
  /**
   * カットイン発火。参加者は id で自分の scene.cutins から画像を引く(image を
   * 丸ごと送ると data URL が巨大になり Realtime を詰まらせるため送らない)。
   */
  | { type: "cutin"; cutinId: string }
  | { type: "telop"; text: string }
  | { type: "memo"; text: string }
  /**
   * 音声(GM のローカル音源を data URL で配信)。
   *   - channel "bgm": ループ再生。src=null で停止。
   *   - channel "se": 単発再生(効果音 / カットイン音)。
   */
  | { type: "audio"; channel: "bgm" | "se"; src: string | null; loop?: boolean }
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
  /** 参加者が自分の登場させた駒を片付ける(GM が所有者一致を検証)。 */
  | { kind: "remove-char"; panelId: string }
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

/**
 * ライブ(ephemeral)ペイロード。ドラッグ中の駒座標など、高頻度・ロスしてよい・
 * 順序不問の一時情報。確実配信(チャンク+ack+逐次キュー)を通さず、生の broadcast で
 * 投げっぱなしにする(確定は state が担保するので落ちても問題ない)。
 */
export type LiveMsg = { kind: "drag"; panelId: string; x: number; y: number };

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
  /** ライブ(ephemeral)送信。投げっぱなし(ack 待ち/チャンク/逐次化なし)。 */
  sendLive: (msg: LiveMsg) => void;
  onMessage: (cb: (msg: NetMsg) => void) => void;
  /** ライブ(ephemeral)受信。ドラッグ中の駒座標など。 */
  onLive: (cb: (msg: LiveMsg) => void) => void;
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
  opts?: {
    /**
     * 送信直前にメッセージを変換する(GM がメディアを Storage の URL に差し替える
     * のに使う)。変換は送信キュー内で行うので逐次・確実。
     */
    transform?: (msg: NetMsg) => Promise<NetMsg>;
  },
): Promise<Room> {
  const topic = `play_${code}`;
  const transform = opts?.transform;

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
  let onLiveCb: (msg: LiveMsg) => void = () => {};
  let onPres: (names: string[]) => void = () => {};
  let onProg: (p: { received: number; total: number } | null) => void = () => {};
  const buffers = new Map<
    string,
    { parts: string[]; got: number; n: number; t0: number }
  >();

  channel.on("broadcast", { event: "chunk" }, ({ payload }) => {
    const c = payload as ChunkPayload;
    let buf = buffers.get(c.mid);
    if (!buf) {
      buf = {
        parts: new Array<string>(c.n).fill(""),
        got: 0,
        n: c.n,
        t0: performance.now(),
      };
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
      const text = buf.parts.join("");
      // 計測: 大きい受信(卓データ等)の所要時間 / サイズ / チャンク数。
      if (buf.n > 1) {
        const dt = performance.now() - buf.t0;
        const kb = Math.round(text.length / 1024);
        console.info(
          `[net.recv] ${kb}KB / ${buf.n}chunks / ${Math.round(dt)}ms / ${Math.round(
            kb / (dt / 1000),
          )}KB/s`,
        );
      }
      try {
        onMsg(JSON.parse(text) as NetMsg);
      } catch {
        // 壊れたメッセージは無視
      }
    }
  });

  // ライブ(ephemeral)受信: ドラッグ中の駒座標など。チャンク再組立を通さず即適用。
  channel.on("broadcast", { event: "live" }, ({ payload }) => {
    onLiveCb(payload as LiveMsg);
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
    const mid = crypto.randomUUID();
    const tEnqueue = performance.now();
    const task = sendQueue.then(async () => {
      const tStart = performance.now();
      // 送信直前に変換(メディア → Storage URL 化)。キュー内なので逐次。
      const m = transform ? await transform(msg) : msg;
      const tPrepped = performance.now();
      const json = JSON.stringify(m);
      const n = Math.max(1, Math.ceil(json.length / CHUNK));
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
      // 計測: 大きい送信(卓データ/音声)や複数チャンクの所要時間を出す。
      // send=実送信時間, wait=キュー待ち, /chunk はほぼ ack 往復(RTT)の目安。
      if (n > 1 || msg.type === "state" || msg.type === "audio") {
        const tEnd = performance.now();
        const prepMs = tPrepped - tStart; // 変換(メディアの Storage アップ含む)
        const sendMs = tEnd - tPrepped; // チャンク送信(ack 直列)
        const waitMs = tStart - tEnqueue;
        const kb = Math.round(json.length / 1024);
        console.info(
          `[net.send] ${msg.type} ${kb}KB / ${n}chunks / prep ${Math.round(
            prepMs,
          )}ms / send ${Math.round(sendMs)}ms (${Math.round(
            sendMs / n,
          )}ms/chunk) / wait ${Math.round(waitMs)}ms`,
        );
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
        // 計測: 接続先プロジェクト + ack 往復(≒ネットワーク遅延=リージョンの近さ)。
        // ~50ms=近い(Tokyo 等) / ~200ms=遠い。大きいほど直列送信が遅くなる。
        console.info(`[net.project] ${import.meta.env.VITE_SUPABASE_URL ?? "(env未設定)"}`);
        void (async () => {
          const t0 = performance.now();
          try {
            await channel.send({ type: "broadcast", event: "ping", payload: {} });
            console.info(`[net.rtt] ack ~${Math.round(performance.now() - t0)}ms`);
          } catch {
            // 無視
          }
        })();
        resolve({
          code,
          selfId,
          send,
          // ライブ送信: ack 待ち/チャンク/逐次キューを通さず投げっぱなし。高頻度でも
          // 詰まらない(確定は state が担保するので落ちても問題ない)。
          sendLive: (m) => {
            void channel.send({ type: "broadcast", event: "live", payload: m });
          },
          onMessage: (cb) => {
            onMsg = cb;
          },
          onLive: (cb) => {
            onLiveCb = cb;
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

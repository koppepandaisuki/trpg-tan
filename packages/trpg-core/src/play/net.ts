import type { PlayEvent, PlayScene, Panel, MemoPage } from "./types.js";

/**
 * ネットワーク同期(卓のリアルタイム配信)の共有プロトコル。
 *
 * 設計は「GM 権威のイベントソーシング」:
 *   - GM がルームを開き、確定済みイベント(PlayEvent)を配信する
 *   - 参加者はスナップショット + イベント列から同じ状態を再構成する(reduce)
 *   - 参加者の操作は intent として GM へ送り、GM が正規イベント化して配信
 *     (乱数は GM で消費 → 全員の出目が一致する)
 *
 * 画像(data URL)が大きいので、全メッセージを JSON 文字列のチャンク
 * (CHUNK 文字ずつ)に割って送る。Realtime のペイロード上限対策。
 *
 * ここには「プロトコルの中身」(チャンク分割・ack 再送・逐次キュー・進捗)
 * だけを置き、実際の通信は `RoomTransport` として呼び出し側から注入する。
 * @trpg/core をランタイム依存ゼロに保ったまま、デスクトップ(Vite)と
 * Web(Next.js)が **同一のプロトコル実装** を共有するための境界。
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
  /**
   * 画像束(key→data URL or 公開 URL)。state は画像を "cas:<key>" 参照に置き換えた
   * 軽量版を流し、画像実体は初出のものだけこの media で別送する(駒移動のたびに
   * 1〜2MB を再送せず、参加者のラグを防ぐ)。state より前に送られる。
   */
  | { type: "media"; media: Record<string, string> }
  | { type: "intent"; from: string; intent: NetIntent }
  /**
   * カットイン発火。参加者は id で自分の scene.cutins から画像を引く(image を
   * 丸ごと送ると data URL が巨大になり Realtime を詰まらせるため送らない)。
   */
  | { type: "cutin"; cutinId: string }
  | { type: "telop"; text: string }
  | { type: "memo"; memos: MemoPage[] }
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
      /** 発言の文字色(CSS color)。 */
      color?: string;
    }
  | { kind: "resource"; panelId: string; resourceKey: string; delta: number }
  | { kind: "move"; panelId: string; x: number; y: number }
  | { kind: "memo"; memos: MemoPage[] }
  /** 参加者が自分のキャラを登場させる(GM が owner を刻んで panel-add)。 */
  | { kind: "add-char"; panel: Panel }
  /** 参加者が自分の登場させた駒を片付ける(GM が所有者一致を検証)。 */
  | { kind: "remove-char"; panelId: string }
  /** 参加者が GM/他人のキャラ駒を「自分の駒にする」(GM が owner を送信者名で刻む)。 */
  | { kind: "claim-char"; panelId: string }
  | {
      kind: "panel-update";
      panelId: string;
      patch: {
        name?: string;
        note?: string;
        palette?: string;
        speed?: number;
        /** 自分の駒のサイズ変更(円形駒は size のみ、画像は size+height)。 */
        size?: number;
        height?: number;
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

/**
 * 通信の実体。呼び出し側(デスクトップ / Web)が Supabase Realtime 等で実装する。
 * core はこのインターフェースだけに依存する(= ランタイム依存ゼロを維持)。
 */
export interface RoomTransport {
  /** broadcast 送信。到達確認できたら true(ack)。 */
  send(event: string, payload: unknown): Promise<boolean>;
  /** broadcast 受信の購読(event ごとに 1 つ)。 */
  onBroadcast(event: string, cb: (payload: unknown) => void): void;
  /** presence 同期。現在参加中の表示名一覧を渡す。 */
  onPresenceSync(cb: (names: string[]) => void): void;
  /** 切断。 */
  close(): Promise<void>;
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
export function makeRoomCode(
  randomValues: (n: number) => Uint32Array = defaultRandomValues,
): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  // Math.random は予測可能性があるため、参加コード(部外者の飛び込み防止)には
  // 暗号学的乱数を使う。32 文字集合なので % による偏りもない(2^32 % 32 = 0)。
  const rand = randomValues(6);
  let s = "";
  for (let i = 0; i < 6; i++) {
    s += chars[rand[i] % chars.length];
  }
  return s;
}

function defaultRandomValues(n: number): Uint32Array {
  const arr = new Uint32Array(n);
  globalThis.crypto.getRandomValues(arr);
  return arr;
}

/** ルームの topic 名(トランスポート側のチャンネル名に使う)。 */
export function roomTopic(code: string): string {
  return `play_${code}`;
}

/**
 * トランスポートの上に「確実配信プロトコル」を載せて Room を作る。
 *
 * 送信: JSON 化 → CHUNK 文字ずつ分割 → 1 本のキューで逐次送信(ack 待ち)。
 *       失敗は最大 4 回まで指数的に間を空けて再送。
 * 受信: mid 単位でチャンクを組み立て、揃ったら JSON.parse して onMessage。
 */
export function createRoom(
  transport: RoomTransport,
  params: {
    code: string;
    selfId: string;
    /**
     * 送信直前にメッセージを変換する(GM がメディアを Storage の URL に差し替える
     * のに使う)。変換は送信キュー内で行うので逐次・確実。
     */
    transform?: (msg: NetMsg) => Promise<NetMsg>;
    /** 計測ログの出力先。既定は無出力(呼び出し側で console を渡せる)。 */
    log?: (line: string) => void;
    makeId?: () => string;
  },
): Room {
  const { code, selfId, transform } = params;
  const log = params.log ?? (() => {});
  const makeId = params.makeId ?? (() => globalThis.crypto.randomUUID());

  let onMsg: (msg: NetMsg) => void = () => {};
  let onLiveCb: (msg: LiveMsg) => void = () => {};
  let onPres: (names: string[]) => void = () => {};
  let onProg: (p: { received: number; total: number } | null) => void = () => {};
  const buffers = new Map<
    string,
    { parts: string[]; got: number; n: number; t0: number }
  >();

  transport.onBroadcast("chunk", (payload) => {
    const c = payload as ChunkPayload;
    let buf = buffers.get(c.mid);
    if (!buf) {
      buf = {
        parts: new Array<string>(c.n).fill(""),
        got: 0,
        n: c.n,
        t0: now(),
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
        const dt = now() - buf.t0;
        const kb = Math.round(text.length / 1024);
        log(
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
  transport.onBroadcast("live", (payload) => {
    onLiveCb(payload as LiveMsg);
  });

  transport.onPresenceSync((names) => onPres(names));

  // 送信は 1 本のキューで逐次化する。スナップショット(画像入りで数 MB に
  // なり得る)のチャンクを一気に投げるとレート制限に当たるため。ack があるので
  // send() はサーバ確認まで待つ = 1 チャンクずつ確実に流れる。
  let sendQueue: Promise<void> = Promise.resolve();
  function send(msg: NetMsg): Promise<void> {
    const mid = makeId();
    const tEnqueue = now();
    const task = sendQueue.then(async () => {
      const tStart = now();
      // 送信直前に変換(メディア → Storage URL 化)。キュー内なので逐次。
      const m = transform ? await transform(msg) : msg;
      const tPrepped = now();
      const json = JSON.stringify(m);
      const n = Math.max(1, Math.ceil(json.length / CHUNK));
      for (let i = 0; i < n; i++) {
        const payload: ChunkPayload = {
          mid,
          i,
          n,
          data: json.slice(i * CHUNK, (i + 1) * CHUNK),
        };
        // 取りこぼし対策で数回まで再送。
        let ok = false;
        for (let attempt = 0; attempt < 4 && !ok; attempt++) {
          try {
            ok = await transport.send("chunk", payload);
          } catch {
            ok = false;
          }
          if (!ok) await sleep(150 * (attempt + 1));
        }
        if (!ok) return; // 数回試して駄目ならこのメッセージは諦める(後続は続行)
      }
      // 計測: 大きい送信(卓データ/音声)や複数チャンクの所要時間を出す。
      // send=実送信時間, wait=キュー待ち, /chunk はほぼ ack 往復(RTT)の目安。
      if (n > 1 || msg.type === "state" || msg.type === "audio") {
        const tEnd = now();
        const prepMs = tPrepped - tStart; // 変換(メディアの Storage アップ含む)
        const sendMs = tEnd - tPrepped; // チャンク送信(ack 直列)
        const waitMs = tStart - tEnqueue;
        const kb = Math.round(json.length / 1024);
        log(
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

  return {
    code,
    selfId,
    send,
    // ライブ送信: ack 待ち/チャンク/逐次キューを通さず投げっぱなし。高頻度でも
    // 詰まらない(確定は state が担保するので落ちても問題ない)。
    sendLive: (m) => {
      void transport.send("live", m);
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
      void sendQueue.then(() => transport.close());
    },
  };
}

function now(): number {
  return typeof globalThis.performance?.now === "function"
    ? globalThis.performance.now()
    : Date.now();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

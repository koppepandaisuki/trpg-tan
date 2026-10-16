import type { NetMsg } from "./net.js";
import type { PlayEvent, PlayScene } from "./types.js";
import { privateRecipients } from "./secrets.js";

/**
 * 相手ごとの暗号化(GM ⇔ 参加者 1 人)。シークレットダイスの出目・個別チャットを、
 * 宛先の参加者だけが読める形で送る(secrets.ts)。
 *
 *   - 鍵交換: ECDH(P-256)。参加者は hello に公開鍵を載せ、GM は "key" で自分の公開鍵を配る。
 *     双方が相手の公開鍵と自分の秘密鍵から同じ共通鍵(AES-GCM 256)を導く。
 *   - 秘密鍵は端末から出ない。通信に載るのは公開鍵と暗号文だけなので、全員に届く中継を
 *     通っても、宛先以外の参加者には読めない。
 *   - WebCrypto(ブラウザ / Tauri の WebView / Node 20+)を使う。外部ライブラリは使わない。
 *
 * 限界: 公開鍵そのものの真正性(なりすまし)は検証しない。GM は「同じ参加者 id に対して
 * 最初に届いた公開鍵」だけを採用する(後から別の鍵で上書きさせない)。
 */

const subtle = () => globalThis.crypto.subtle;
/** WebCrypto の鍵(DOM の型名に依存しないよう、実際の API から型を取る)。 */
type Key = Awaited<ReturnType<ReturnType<typeof subtle>["deriveKey"]>>;

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}

/** base64 → ArrayBuffer(WebCrypto の BufferSource にそのまま渡せる形)。 */
function fromB64(b64: string): ArrayBuffer {
  const s = atob(b64);
  const buf = new ArrayBuffer(s.length);
  const u8 = new Uint8Array(buf);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return buf;
}

function utf8(text: string): ArrayBuffer {
  const u8 = new TextEncoder().encode(text);
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

export interface SecretBox {
  /** 自分の公開鍵(base64)。hello / key に載せる。 */
  readonly publicKey: string;
  /** 相手の公開鍵を登録する。同じ id に別の鍵が来ても上書きしない(最初のものを採用)。 */
  addPeer(id: string, publicKey: string): Promise<boolean>;
  /** 相手を忘れる(退室させたとき等)。 */
  removePeer(id: string): void;
  hasPeer(id: string): boolean;
  /** 相手(id)宛てに暗号化した "sealed" メッセージを作る。鍵が無ければ null。 */
  seal(to: string, msg: NetMsg): Promise<Extract<NetMsg, { type: "sealed" }> | null>;
  /** 相手(from の id)からの暗号文を開く。開けなければ null。 */
  open(
    from: string,
    msg: Extract<NetMsg, { type: "sealed" }>,
  ): Promise<NetMsg | null>;
}

export async function createSecretBox(): Promise<SecretBox> {
  const pair = (await subtle().generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveKey"],
  )) as { publicKey: Key; privateKey: Key };
  const raw = await subtle().exportKey("raw", pair.publicKey);
  const publicKey = toB64(raw);
  const keys = new Map<string, { pub: string; key: Key }>();

  return {
    publicKey,
    async addPeer(id, pub) {
      const cur = keys.get(id);
      if (cur) return cur.pub === pub;
      try {
        const peerKey = await subtle().importKey(
          "raw",
          fromB64(pub),
          { name: "ECDH", namedCurve: "P-256" },
          false,
          [],
        );
        const key = await subtle().deriveKey(
          { name: "ECDH", public: peerKey },
          pair.privateKey,
          { name: "AES-GCM", length: 256 },
          false,
          ["encrypt", "decrypt"],
        );
        if (!keys.has(id)) keys.set(id, { pub, key });
        return keys.get(id)!.pub === pub;
      } catch {
        return false;
      }
    },
    removePeer(id) {
      keys.delete(id);
    },
    hasPeer(id) {
      return keys.has(id);
    },
    async seal(to, msg) {
      const k = keys.get(to);
      if (!k) return null;
      const iv = new ArrayBuffer(12);
      globalThis.crypto.getRandomValues(new Uint8Array(iv));
      const data = await subtle().encrypt(
        { name: "AES-GCM", iv },
        k.key,
        utf8(JSON.stringify(msg)),
      );
      return { type: "sealed", to, iv: toB64(iv), data: toB64(data) };
    },
    async open(from, msg) {
      const k = keys.get(from);
      if (!k) return null;
      try {
        const plain = await subtle().decrypt(
          { name: "AES-GCM", iv: fromB64(msg.iv) },
          k.key,
          fromB64(msg.data),
        );
        return JSON.parse(new TextDecoder().decode(plain)) as NetMsg;
      } catch {
        return null;
      }
    },
  };
}

/**
 * GM 側: 出来事のうち各参加者に個別に見せるものを、その参加者宛てに暗号化して送る。
 * members は参加者 id → 入室名(hello で記録したもの)。
 */
export async function sendPrivateEvents(params: {
  box: SecretBox;
  send: (msg: NetMsg) => Promise<void>;
  members: Iterable<[string, string]>;
  scene: PlayScene;
  evs: PlayEvent[];
}): Promise<void> {
  const { box, send, scene, evs } = params;
  if (evs.length === 0) return;
  for (const [id, name] of params.members) {
    const mine = evs.filter((ev) => privateRecipients(ev, scene).includes(name));
    if (mine.length === 0) continue;
    const sealed = await box.seal(id, { type: "reveal", evs: mine });
    if (sealed) await send(sealed);
  }
}

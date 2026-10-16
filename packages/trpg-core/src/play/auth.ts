import type { NetMsg } from "./net.js";

/**
 * 送り主の確認(なりすまし対策)。
 *
 * 卓の通信は全員が同じ経路(P2P / 中継)に乗るので、署名が無いと、悪意のある参加者が
 * 「GM を装った配信」(卓の上書き・退室・閉卓)や「他の参加者を装った操作」を送れてしまう。
 *
 *   - 全員が ECDSA(P-256)の鍵を持ち、送る全メッセージに署名する(net.ts の createRoom)。
 *   - **参加コードは GM の公開鍵から作る**(公開鍵の SHA-256 → 6 文字)。参加者は
 *     「署名した鍵がこの参加コードの鍵か」を確かめるだけで、本物の GM を見分けられる
 *     (別の鍵で同じコードを作るには約 10 億回の鍵生成が要る)。
 *   - GM は参加者ごとに hello の署名鍵を覚え(最初のものを採用)、以後の操作はその鍵の
 *     署名があるものだけ受け付ける。
 *   - 署名の無い旧版アプリとも遊べるよう、本物の GM の署名を一度確かめるまでは
 *     署名なしも受け付け、確かめた後は GM からのメッセージに署名を必須にする。
 */

const subtle = () => globalThis.crypto.subtle;
type Key = Awaited<ReturnType<ReturnType<typeof subtle>["importKey"]>>;

/** 参加コードの文字集合(makeRoomCode と同じ。紛らわしい文字を除いた 32 文字)。 */
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function toB64(buf: ArrayBuffer): string {
  const u8 = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}

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

export interface Signer {
  /** 公開鍵(raw、base64)。 */
  readonly publicKey: string;
  sign(text: string): Promise<string>;
}

const ECDSA = { name: "ECDSA", namedCurve: "P-256" } as const;
const SIG = { name: "ECDSA", hash: "SHA-256" } as const;

export async function createSigner(): Promise<Signer> {
  const pair = (await subtle().generateKey(ECDSA, true, ["sign", "verify"])) as {
    publicKey: Key;
    privateKey: Key;
  };
  const publicKey = toB64(await subtle().exportKey("raw", pair.publicKey));
  return {
    publicKey,
    async sign(text) {
      return toB64(await subtle().sign(SIG, pair.privateKey, utf8(text)));
    },
  };
}

const keyCache = new Map<string, Promise<Key | null>>();

function importPublic(pk: string): Promise<Key | null> {
  let p = keyCache.get(pk);
  if (!p) {
    p = subtle()
      .importKey("raw", fromB64(pk), ECDSA, false, ["verify"])
      .catch(() => null);
    keyCache.set(pk, p);
    if (keyCache.size > 256) keyCache.delete(keyCache.keys().next().value!);
  }
  return p;
}

/** 署名を確かめる(壊れた鍵・署名は false)。 */
export async function verifySignature(
  pk: string,
  text: string,
  sig: string,
): Promise<boolean> {
  try {
    const key = await importPublic(pk);
    if (!key) return false;
    return await subtle().verify(SIG, key, fromB64(sig), utf8(text));
  } catch {
    return false;
  }
}

const codeCache = new Map<string, Promise<string>>();

/** 公開鍵から参加コード(6 文字)を作る。GM はこれを参加コードにする。 */
export function codeForKey(pk: string): Promise<string> {
  let p = codeCache.get(pk);
  if (!p) {
    p = subtle()
      .digest("SHA-256", fromB64(pk))
      .then((h) => {
        const b = new Uint8Array(h);
        // 先頭 30 ビットを 5 ビットずつ 6 文字に。
        let bits = 0;
        let acc = 0;
        let out = "";
        for (let i = 0; out.length < 6; i++) {
          acc = (acc << 8) | b[i];
          bits += 8;
          while (bits >= 5 && out.length < 6) {
            bits -= 5;
            out += CODE_CHARS[(acc >> bits) & 31];
          }
        }
        return out;
      });
    codeCache.set(pk, p);
  }
  return p;
}

/** 受信したメッセージの送り主の情報(createRoom が署名を確かめて付ける)。 */
export interface MsgMeta {
  /** 署名を確かめられた送り主の公開鍵。署名なし / 不正なら undefined。 */
  signer?: string;
}

/** GM だけが送るメッセージ。 */
const GM_TYPES = new Set<NetMsg["type"]>([
  "state",
  "patch",
  "tick",
  "event",
  "memo",
  "media",
  "cutin",
  "telop",
  "audio",
  "closed",
  "kick",
  "key",
  "sealed",
  "reveal",
  "hand",
]);

/**
 * 参加者側: GM からのメッセージを受け入れてよいか。
 * 参加コードの鍵の署名を一度確かめたら、以後 GM のメッセージには署名を必須にする
 * (それまでは旧版の GM のため署名なしも受け入れる)。
 */
export function createGmGate(code: string): {
  accept(msg: NetMsg, meta: MsgMeta): Promise<boolean>;
  /** 本物の GM の署名を確かめ済みか(表示用)。 */
  readonly verified: boolean;
} {
  let verified = false;
  return {
    get verified() {
      return verified;
    },
    async accept(msg, meta) {
      if (!GM_TYPES.has(msg.type)) return true; // 参加者どうしのもの(参加者は使わない)
      if (meta.signer && (await codeForKey(meta.signer)) === code) {
        verified = true;
        return true;
      }
      return !verified && !meta.signer;
    },
  };
}

/**
 * GM 側: 参加者 id ごとに、hello に署名した鍵を覚える(最初のものを採用)。
 * 以後その id の hello / 操作は、同じ鍵の署名があるものだけ受け付ける
 * (他の参加者が id を騙って駒を動かす・発言するのを防ぐ)。署名の無い旧版の参加者は
 * 鍵を覚えないので、従来どおり受け付ける。
 */
export function createMemberGate(): {
  accept(msg: NetMsg, meta: MsgMeta): boolean;
  forget(id: string): void;
  clear(): void;
} {
  const keys = new Map<string, string>();
  return {
    accept(msg, meta) {
      if (msg.type !== "hello" && msg.type !== "intent") return true;
      const known = keys.get(msg.from);
      if (known) return meta.signer === known;
      if (meta.signer && msg.type === "hello") keys.set(msg.from, meta.signer);
      return true;
    },
    forget(id) {
      keys.delete(id);
    },
    clear() {
      keys.clear();
    },
  };
}

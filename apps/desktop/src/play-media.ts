import { readFile } from "@tauri-apps/plugin-fs";
import type { PlayScene, PlayEvent, Panel } from "@trpg/core";
import { supabase } from "./supabase";
import { audioDataUrl } from "./audio-url";
import type { NetMsg } from "./net";

/**
 * PLAY のメディア(画像/音声)を Supabase Storage に逃がすためのユーティリティ。
 *
 * 目的: マルチ同期で base64 を Realtime に流すと数 MB が直列送信されて非常に
 * 遅い。そこで「ネットに送る直前」にメディアを Storage(public バケット "play")
 * へアップロードし、卓データの中の data URL を公開 URL に差し替える。参加者は
 * HTTP/CDN から並列・キャッシュ付きで取得するので、Realtime には小さな JSON
 * だけが流れる。
 *
 * 設計:
 *   - ローカルの卓(.play)は base64 のまま(オフライン・自己完結・可搬性を維持)。
 *   - 内容(SHA-256)でハッシュ化し `<user_id>/<hash>.<ext>` に置く = 同じ画像は
 *     1 回だけアップロード。data URL / パス単位でメモリキャッシュ。
 *   - 未ログインやアップロード失敗時は元の data URL のまま使う(劣化はするが動く)。
 */

const BUCKET = "play";

// undefined=未取得 / null=未ログイン / string=uid
let userIdCache: string | null | undefined;
async function userId(): Promise<string | null> {
  if (userIdCache !== undefined) return userIdCache;
  try {
    const { data } = await supabase.auth.getUser();
    userIdCache = data.user?.id ?? null;
  } catch {
    userIdCache = null;
  }
  return userIdCache;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function extOfMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("webp")) return "webp";
  if (m.includes("gif")) return "gif";
  if (m.includes("svg")) return "svg";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("wav")) return "wav";
  if (m.includes("ogg") || m.includes("opus")) return "ogg";
  if (m.includes("mp4") || m.includes("m4a") || m.includes("aac")) return "m4a";
  if (m.includes("flac")) return "flac";
  return "bin";
}

function mimeOfExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "wav":
      return "audio/wav";
    case "ogg":
    case "opus":
      return "audio/ogg";
    case "m4a":
    case "mp4":
    case "aac":
      return "audio/mp4";
    case "flac":
      return "audio/flac";
    default:
      return "audio/mpeg";
  }
}

function parseDataUrl(d: string): { mime: string; bytes: Uint8Array } | null {
  const comma = d.indexOf(",");
  if (!d.startsWith("data:") || comma < 0) return null;
  const header = d.slice(5, comma); // e.g. "image/png;base64"
  const isB64 = /;base64$/i.test(header);
  const mime = header.replace(/;base64$/i, "") || "application/octet-stream";
  const data = d.slice(comma + 1);
  try {
    if (isB64) {
      const bin = atob(data);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return { mime, bytes };
    }
    return { mime, bytes: new TextEncoder().encode(decodeURIComponent(data)) };
  } catch {
    return null;
  }
}

async function uploadBytes(
  bytes: Uint8Array,
  mime: string,
  ext: string,
): Promise<string | null> {
  const uid = await userId();
  if (!uid) return null; // 未ログイン: アップロード不可
  const hash = await sha256Hex(bytes);
  const path = `${uid}/${hash}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, new Blob([bytes as BlobPart], { type: mime }), {
      contentType: mime,
      upsert: false,
    });
  // 既に同じハッシュが存在するのは正常(内容アドレス指定)。それ以外は失敗扱い。
  if (error && !/exist|dupl|conflict|409/i.test(error.message)) return null;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

const dataUrlCache = new Map<string, string>();
/** data URL を Storage にアップして公開 URL を返す。失敗時は元の data URL。 */
export async function uploadDataUrl(s: string): Promise<string> {
  if (!s || !s.startsWith("data:")) return s; // 既に URL / 空
  const hit = dataUrlCache.get(s);
  if (hit) return hit;
  const parsed = parseDataUrl(s);
  if (!parsed) return s;
  try {
    const url = await uploadBytes(parsed.bytes, parsed.mime, extOfMime(parsed.mime));
    if (!url) return s;
    dataUrlCache.set(s, url);
    return url;
  } catch {
    return s;
  }
}

const pathCache = new Map<string, string>();
/** ローカル音声ファイルを Storage にアップして公開 URL を返す。失敗時は base64。 */
export async function uploadAudioPath(path: string): Promise<string> {
  const hit = pathCache.get(path);
  if (hit) return hit;
  try {
    const bytes = (await readFile(path)) as Uint8Array;
    const ext = path.split(".").pop()?.toLowerCase() || "mp3";
    const url = await uploadBytes(bytes, mimeOfExt(ext), ext);
    if (!url) return audioDataUrl(path); // 未ログイン: base64 フォールバック
    pathCache.set(path, url);
    return url;
  } catch {
    return audioDataUrl(path);
  }
}

/** data URL のときだけアップロードして URL に。それ以外はそのまま。 */
async function up<T extends string | null | undefined>(s: T): Promise<T> {
  if (typeof s === "string" && s.startsWith("data:")) {
    return (await uploadDataUrl(s)) as T;
  }
  return s;
}

async function sanitizePanel(p: Panel): Promise<Panel> {
  const portrait = await up(p.portrait);
  const variants =
    p.variants && p.variants.length
      ? await Promise.all(
          p.variants.map(async (v) => ({ ...v, image: await up(v.image) })),
        )
      : p.variants;
  return { ...p, portrait, variants };
}

async function sanitizeScene(scene: PlayScene): Promise<PlayScene> {
  const panels = await Promise.all((scene.panels ?? []).map(sanitizePanel));
  const cutins = scene.cutins
    ? await Promise.all(
        scene.cutins.map(async (c) => ({ ...c, image: await up(c.image) })),
      )
    : scene.cutins;
  const assets = scene.assets
    ? await Promise.all(
        scene.assets.map(async (a) => ({
          ...a,
          image: await up(a.image),
          actions: a.actions
            ? await Promise.all(
                a.actions.map(async (ac) => ({ ...ac, image: await up(ac.image) })),
              )
            : a.actions,
        })),
      )
    : scene.assets;
  const board = scene.board
    ? {
        ...scene.board,
        image: await up(scene.board.image),
        foreground: await up(scene.board.foreground),
      }
    : scene.board;
  const scenes = scene.scenes
    ? await Promise.all(
        scene.scenes.map(async (sc) =>
          sc.board
            ? {
                ...sc,
                board: {
                  ...sc.board,
                  image: await up(sc.board.image),
                  foreground: await up(sc.board.foreground),
                },
              }
            : sc,
        ),
      )
    : scene.scenes;
  return { ...scene, panels, cutins, assets, board, scenes };
}

async function sanitizeEvent(ev: PlayEvent): Promise<PlayEvent> {
  if (ev.kind === "panel-add") return { ...ev, panel: await sanitizePanel(ev.panel) };
  if (ev.kind === "board-set") {
    const next = { ...ev };
    if (ev.image) next.image = await up(ev.image);
    if (ev.foreground) next.foreground = await up(ev.foreground);
    return next;
  }
  if (ev.kind === "panel-update") {
    const patch = { ...ev.patch };
    if (patch.portrait) patch.portrait = await up(patch.portrait);
    if (patch.variants && patch.variants.length) {
      patch.variants = await Promise.all(
        patch.variants.map(async (v) => ({ ...v, image: await up(v.image) })),
      );
    }
    return { ...ev, patch };
  }
  return ev;
}

/**
 * ネット送信前に、メッセージ内のメディア(data URL)を Storage の公開 URL に
 * 差し替える。connectRoom の transform に渡す(GM 側のみ)。
 */
export async function sanitizeForNet(msg: NetMsg): Promise<NetMsg> {
  switch (msg.type) {
    case "state":
      return { ...msg, scene: await sanitizeScene(msg.scene) };
    case "event":
      return { ...msg, ev: await sanitizeEvent(msg.ev) };
    case "cutin":
      // id のみ送るので変換不要。
      return msg;
    case "media": {
      // 画像束(key→data URL)。各 data URL を Storage の URL に逃がす(ログイン時)。
      const out: Record<string, string> = {};
      await Promise.all(
        Object.entries(msg.media).map(async ([k, v]) => {
          out[k] = await up(v);
        }),
      );
      return { ...msg, media: out };
    }
    case "audio":
      return msg.src ? { ...msg, src: await up(msg.src) } : msg;
    default:
      return msg;
  }
}

/* ===== state の画像分離(CAS: 内容アドレス参照) =====
 *
 * 問題: state(スナップショット)に画像 data URL を毎回丸ごと載せると、未ログインや
 * アップロード失敗時に 1〜2MB の JSON を駒移動のたびに送ることになり、参加者側に
 * 大きなラグが出る(送信に数秒 → その間の操作が後ろへ積まれる)。
 *
 * 対策: scene 内の data URL を short な参照キー("cas:<key>")へ置き換えた「軽量
 * state」と、key→data URL の「画像束(media)」に分離する。state は毎回軽量に流し、
 * 画像は別メッセージで「初めて出た画像だけ」送る(= 駒移動では画像を再送しない)。
 * 同じ画像(複数の駒で使い回す立ち絵など)は同じ key になり 1 回しか送られない。
 */

/** オブジェクトを再帰走査し、文字列だけ fn で変換した新オブジェクトを返す。 */
function mapStrings(v: unknown, fn: (s: string) => string): unknown {
  if (typeof v === "string") return fn(v);
  if (Array.isArray(v)) return v.map((x) => mapStrings(x, fn));
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) out[k] = mapStrings(val, fn);
    return out;
  }
  return v;
}

/** data URL → 短い参照キー(同期・簡易ハッシュ。長さも混ぜて衝突を抑える)。 */
function casKey(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${(h >>> 0).toString(36)}_${s.length.toString(36)}`;
}

/**
 * scene 内の画像(data URL)を取り出し、本体は "cas:<key>" 参照へ置き換える。
 * 返り値 media は key→data URL。state を軽量に保ち、画像を別送・差分化するための前処理。
 */
export function splitSceneMedia(scene: PlayScene): {
  lite: PlayScene;
  media: Record<string, string>;
} {
  const media: Record<string, string> = {};
  const lite = mapStrings(scene, (s) => {
    if (s.startsWith("data:")) {
      const key = casKey(s);
      media[key] = s;
      return `cas:${key}`;
    }
    return s;
  }) as PlayScene;
  return { lite, media };
}

/** "cas:<key>" 参照を media マップの実体(URL/data URL)へ復元する。 */
export function resolveSceneMedia(
  lite: PlayScene,
  mediaMap: Map<string, string>,
): PlayScene {
  return mapStrings(lite, (s) => {
    if (s.startsWith("cas:")) return mediaMap.get(s.slice(4)) ?? s;
    return s;
  }) as PlayScene;
}

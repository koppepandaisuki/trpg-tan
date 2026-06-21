import type { SystemDef, GenericSheet } from "../system-builder/types.js";
import { PLAY_SCHEMA_VERSION, type PlayScene } from "../play/types.js";
import { CCSHEET_SCHEMA_VERSION } from "../character/types.js";

/**
 * 配布パッケージ(.paradice)。ストアで売買し、買った側が「セットアップ無し」で
 * 取り込めるゲーム一式。
 *
 * 設計の核(セキュリティ):
 *   - 中身は **宣言的データのみ**(システム定義 / シート / シナリオ / メディア参照)。
 *     実行コード・スクリプト・任意バイナリは形式として持てない → 「実行される悪意」
 *     が原理的に入らない。取り込み側は parsePack で厳格に検証する。
 *   - 画像/音声は本体に埋め込まず Storage の URL で参照する(collectPackMediaUrls
 *     で全 URL を集め、取り込み側が自分の Storage ドメインに限定して検証する)。
 */

export const PACK_FORMAT = "paradice-pack@1" as const;

/** パッケージが参照するメディア(画像/音声)。実体は Storage。 */
export interface PackMedia {
  url: string;
  /** image/* または audio/*。 */
  mime: string;
  sha256?: string;
  bytes?: number;
}

export interface TrpgPack {
  format: typeof PACK_FORMAT;
  id: string;
  name: string;
  /** セマンティックバージョン文字列("1.0.0" など)。 */
  version: string;
  author?: string;
  description?: string;
  createdAt?: string;
  /** カスタムシステム定義(ダイスボット/シート定義)。 */
  system?: SystemDef;
  /** プリジェネ等の汎用シート。 */
  sheets?: GenericSheet[];
  /** シナリオ(卓データ)。 */
  scenarios?: PlayScene[];
  /** 参照メディアの目録(検証/事前取得用。任意)。 */
  media?: PackMedia[];
}

export interface BuildPackInput {
  id: string;
  name: string;
  version?: string;
  author?: string;
  description?: string;
  now?: string;
  system?: SystemDef;
  sheets?: GenericSheet[];
  scenarios?: PlayScene[];
  media?: PackMedia[];
}

/** パッケージを組み立てる(欠けたメタは既定で補完)。 */
export function buildPack(input: BuildPackInput): TrpgPack {
  return {
    format: PACK_FORMAT,
    id: input.id,
    name: input.name.trim() || "無題のゲーム",
    version: input.version?.trim() || "1.0.0",
    ...(input.author ? { author: input.author } : {}),
    ...(input.description ? { description: input.description } : {}),
    ...(input.now ? { createdAt: input.now } : {}),
    ...(input.system ? { system: input.system } : {}),
    ...(input.sheets && input.sheets.length ? { sheets: input.sheets } : {}),
    ...(input.scenarios && input.scenarios.length
      ? { scenarios: input.scenarios }
      : {}),
    ...(input.media && input.media.length ? { media: input.media } : {}),
  };
}

export function serializePack(pack: TrpgPack): string {
  return JSON.stringify(pack);
}

/* ===== 検証 ===== */

export type ParsePackResult =
  | { ok: true; pack: TrpgPack }
  | { ok: false; error: string };

// 病的に巨大なパッケージを弾く上限(ストア/取り込みの保護)。
const LIMITS = { sheets: 2000, scenarios: 1000, media: 20000 } as const;

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isNonEmpty = (v: unknown): v is string => isStr(v) && v.trim().length > 0;

function validSystem(v: unknown): boolean {
  if (!isObj(v)) return false;
  if (!isNonEmpty(v.id) || !isNonEmpty(v.name)) return false;
  for (const k of ["attributes", "skills", "resources"] as const) {
    if (v[k] !== undefined && !Array.isArray(v[k])) return false;
  }
  return true;
}

function validSheet(v: unknown): boolean {
  return (
    isObj(v) &&
    v.kind === "generic" &&
    v.schemaVersion === CCSHEET_SCHEMA_VERSION &&
    isNonEmpty(v.id) &&
    isStr(v.name)
  );
}

function validScenario(v: unknown): boolean {
  return (
    isObj(v) &&
    v.schemaVersion === PLAY_SCHEMA_VERSION &&
    isNonEmpty(v.id) &&
    isStr(v.title) &&
    Array.isArray(v.panels)
  );
}

function validMedia(v: unknown): boolean {
  if (!isObj(v) || !isNonEmpty(v.url) || !isStr(v.mime)) return false;
  const mime = v.mime.toLowerCase();
  return mime.startsWith("image/") || mime.startsWith("audio/");
}

/**
 * 文字列 / オブジェクトをパッケージとして厳格に検証する。
 * 失敗時は理由つき。成功しても「メディア URL が自分の Storage か」は別途
 * collectPackMediaUrls で取り込み側が確認すること(SSRF/流出対策)。
 */
export function parsePack(input: unknown): ParsePackResult {
  const err = (error: string): ParsePackResult => ({ ok: false, error });
  let obj: unknown = input;
  if (typeof input === "string") {
    try {
      obj = JSON.parse(input);
    } catch {
      return err("JSON として読み込めません");
    }
  }
  if (!isObj(obj)) return err("パッケージの形式が不正です");
  if (obj.format !== PACK_FORMAT) {
    return err(`未対応のパッケージ形式です(${String(obj.format)})`);
  }
  if (!isNonEmpty(obj.id)) return err("id がありません");
  if (!isNonEmpty(obj.name)) return err("name がありません");
  if (!isNonEmpty(obj.version)) return err("version がありません");

  if (obj.system !== undefined && !validSystem(obj.system)) {
    return err("system(システム定義)が不正です");
  }
  if (obj.sheets !== undefined) {
    if (!Array.isArray(obj.sheets)) return err("sheets が配列ではありません");
    if (obj.sheets.length > LIMITS.sheets) return err("sheets が多すぎます");
    if (!obj.sheets.every(validSheet)) return err("sheets に不正な要素があります");
  }
  if (obj.scenarios !== undefined) {
    if (!Array.isArray(obj.scenarios)) return err("scenarios が配列ではありません");
    if (obj.scenarios.length > LIMITS.scenarios)
      return err("scenarios が多すぎます");
    if (!obj.scenarios.every(validScenario))
      return err("scenarios に不正な要素があります(版が不一致など)");
  }
  if (obj.media !== undefined) {
    if (!Array.isArray(obj.media)) return err("media が配列ではありません");
    if (obj.media.length > LIMITS.media) return err("media が多すぎます");
    if (!obj.media.every(validMedia)) return err("media に不正な要素があります");
  }
  return { ok: true, pack: obj as unknown as TrpgPack };
}

/* ===== メディア URL の収集(取り込み側のホワイトリスト検証用) ===== */

function pushUrl(out: Set<string>, v: unknown): void {
  if (typeof v === "string" && /^https?:\/\//i.test(v)) out.add(v);
}

function collectFromScene(out: Set<string>, scene: PlayScene): void {
  pushUrl(out, scene.board?.image);
  for (const s of scene.scenes ?? []) pushUrl(out, s.board?.image);
  for (const c of scene.cutins ?? []) pushUrl(out, c.image);
  for (const a of scene.assets ?? []) {
    pushUrl(out, a.image);
    for (const ac of a.actions ?? []) pushUrl(out, ac.image);
  }
  for (const p of scene.panels ?? []) {
    pushUrl(out, p.portrait);
    for (const v of p.variants ?? []) pushUrl(out, v.image);
  }
  // シナリオ特化ビルダーの画像(HO 添付・NPC 立ち絵)も取り込み側の
  // ホワイトリスト検証に乗せる(検証漏れ=外部 URL 混入を防ぐ)。
  for (const h of scene.scenario?.handouts ?? []) pushUrl(out, h.image);
  for (const n of scene.scenario?.npcs ?? []) pushUrl(out, n.portrait);
}

/**
 * パッケージが参照する http(s) メディア URL を重複なく集める。取り込み側は
 * これらが自分の Storage ドメインに属することを確認してから取り込む。
 */
export function collectPackMediaUrls(pack: TrpgPack): string[] {
  const out = new Set<string>();
  for (const m of pack.media ?? []) pushUrl(out, m.url);
  for (const sh of pack.sheets ?? []) pushUrl(out, sh.image);
  for (const sc of pack.scenarios ?? []) collectFromScene(out, sc);
  return [...out];
}

import "server-only";
import { presignUrl, signHeaders, type SigV4Credentials } from "./sigv4";

/**
 * 卓の素材(画像・音声)の置き場としての Cloudflare R2。
 *
 * Supabase Storage(Free は転送量が月 5GB)の代わりに使うと、参加者が素材を
 * ダウンロードする転送量が無料になる(R2 は egress 無料・保存 10GB まで無料)。
 * env が揃っているときだけ有効。未設定なら従来どおり Supabase Storage に上げる。
 *
 * 必要な env(docs/strategy.md §5 の手順):
 *   R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET
 *   NEXT_PUBLIC_MEDIA_BASE_URL  公開 URL のベース(R2 のカスタムドメイン等。末尾 / なし)
 *
 * キーは Supabase と同じ `<user_id>/<sha256>.<ext>`(内容アドレス指定)。
 */

interface R2Config {
  accountId: string;
  bucket: string;
  publicBase: string;
  creds: SigV4Credentials;
}

function config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  const publicBase = process.env.NEXT_PUBLIC_MEDIA_BASE_URL?.replace(/\/$/, "");
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBase) return null;
  return {
    accountId,
    bucket,
    publicBase,
    creds: { accessKeyId, secretAccessKey, region: "auto", service: "s3" },
  };
}

export function isR2Configured(): boolean {
  return config() !== null;
}

function host(c: R2Config): string {
  return `${c.accountId}.r2.cloudflarestorage.com`;
}

/**
 * ブラウザ / アプリから直接 PUT するための署名付き URL。
 * content-type と content-length を署名に含めるので、申告した種類・大きさ以外は上げられない。
 */
export function presignPut(params: {
  key: string;
  contentType: string;
  contentLength: number;
  expiresSec?: number;
}): { uploadUrl: string; publicUrl: string } | null {
  const c = config();
  if (!c) return null;
  const uploadUrl = presignUrl({
    creds: c.creds,
    method: "PUT",
    host: host(c),
    path: `/${c.bucket}/${params.key}`,
    expiresSec: params.expiresSec ?? 600,
    now: new Date(),
    headers: {
      "content-type": params.contentType,
      "content-length": String(params.contentLength),
    },
  });
  return { uploadUrl, publicUrl: `${c.publicBase}/${params.key}` };
}

/** prefix 配下のキー一覧(最大 1000 件)。 */
export async function listKeys(prefix: string): Promise<string[]> {
  const c = config();
  if (!c) return [];
  const query = { "list-type": "2", prefix, "max-keys": "1000" };
  const headers = signHeaders({
    creds: c.creds,
    method: "GET",
    host: host(c),
    path: `/${c.bucket}`,
    now: new Date(),
    query,
  });
  const qs = new URLSearchParams(query).toString();
  const res = await fetch(`https://${host(c)}/${c.bucket}?${qs}`, { headers, cache: "no-store" });
  if (!res.ok) throw new Error(`R2 list failed: ${res.status}`);
  const xml = await res.text();
  return [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => decodeXml(m[1]));
}

export async function deleteKey(key: string): Promise<void> {
  const c = config();
  if (!c) return;
  const path = `/${c.bucket}/${key}`;
  const headers = signHeaders({ creds: c.creds, method: "DELETE", host: host(c), path, now: new Date() });
  const res = await fetch(`https://${host(c)}${path.split("/").map(encodeURIComponent).join("/")}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok && res.status !== 404) throw new Error(`R2 delete failed: ${res.status}`);
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

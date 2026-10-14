import { createHash, createHmac } from "node:crypto";

/**
 * AWS Signature Version 4(S3 互換 API 用)。Cloudflare R2 は S3 互換なので、
 * R2 への署名付き URL(presigned URL)と、サーバーからの一覧・削除の署名に使う。
 *
 * 外部ライブラリを使わず node:crypto だけで実装(サーバー専用)。
 * AWS 公式ドキュメントの例題でテストしている(tests/storage/sigv4.test.ts)。
 */

const sha256hex = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
const hmac = (key: Buffer | string, s: string) => createHmac("sha256", key).update(s).digest();

/** RFC 3986 のエンコード(S3 の規則: ~ はそのまま、スペースは %20)。 */
export function uriEncode(s: string, encodeSlash = true): string {
  return Array.from(new TextEncoder().encode(s))
    .map((b) => {
      const c = String.fromCharCode(b);
      if (/[A-Za-z0-9\-._~]/.test(c)) return c;
      if (c === "/" && !encodeSlash) return c;
      return "%" + b.toString(16).toUpperCase().padStart(2, "0");
    })
    .join("");
}

export interface SigV4Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  service: string;
}

function signingKey(c: SigV4Credentials, date: string): Buffer {
  const kDate = hmac("AWS4" + c.secretAccessKey, date);
  const kRegion = hmac(kDate, c.region);
  const kService = hmac(kRegion, c.service);
  return hmac(kService, "aws4_request");
}

function canonicalQuery(q: Record<string, string>): string {
  return Object.keys(q)
    .sort()
    .map((k) => `${uriEncode(k)}=${uriEncode(q[k])}`)
    .join("&");
}

/** "20130524T000000Z" 形式。 */
export function amzDate(d: Date): string {
  return d.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

/**
 * 署名付き URL(クエリに署名を載せる)を作る。
 * headers は署名に含めるヘッダー(host は自動)。ブラウザはこれらと同じ値を送る必要がある
 * (content-length を含めれば、その大きさ以外はアップロードできない)。
 */
export function presignUrl(params: {
  creds: SigV4Credentials;
  method: string;
  host: string;
  /** "/bucket/key"(エンコード前)。 */
  path: string;
  expiresSec: number;
  now: Date;
  headers?: Record<string, string>;
  query?: Record<string, string>;
}): string {
  const { creds, method, host, path, expiresSec, now } = params;
  const datetime = amzDate(now);
  const date = datetime.slice(0, 8);
  const scope = `${date}/${creds.region}/${creds.service}/aws4_request`;
  const headers: Record<string, string> = { host };
  for (const [k, v] of Object.entries(params.headers ?? {})) headers[k.toLowerCase()] = v.trim();
  const names = Object.keys(headers).sort();
  const signedHeaders = names.join(";");
  const query: Record<string, string> = {
    ...(params.query ?? {}),
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${creds.accessKeyId}/${scope}`,
    "X-Amz-Date": datetime,
    "X-Amz-Expires": String(expiresSec),
    "X-Amz-SignedHeaders": signedHeaders,
  };
  const canonical = [
    method,
    uriEncode(path, false),
    canonicalQuery(query),
    names.map((n) => `${n}:${headers[n]}\n`).join(""),
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const toSign = ["AWS4-HMAC-SHA256", datetime, scope, sha256hex(canonical)].join("\n");
  const signature = createHmac("sha256", signingKey(creds, date)).update(toSign).digest("hex");
  return `https://${host}${uriEncode(path, false)}?${canonicalQuery(query)}&X-Amz-Signature=${signature}`;
}

/**
 * ヘッダーで署名したリクエスト(サーバーから一覧・削除するとき)。
 * 返り値の headers をそのまま fetch に渡す。
 */
export function signHeaders(params: {
  creds: SigV4Credentials;
  method: string;
  host: string;
  path: string;
  now: Date;
  query?: Record<string, string>;
  body?: string;
}): Record<string, string> {
  const { creds, method, host, path, now } = params;
  const datetime = amzDate(now);
  const date = datetime.slice(0, 8);
  const scope = `${date}/${creds.region}/${creds.service}/aws4_request`;
  const payloadHash = sha256hex(params.body ?? "");
  const headers: Record<string, string> = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": datetime,
  };
  const names = Object.keys(headers).sort();
  const signedHeaders = names.join(";");
  const canonical = [
    method,
    uriEncode(path, false),
    canonicalQuery(params.query ?? {}),
    names.map((n) => `${n}:${headers[n]}\n`).join(""),
    signedHeaders,
    payloadHash,
  ].join("\n");
  const toSign = ["AWS4-HMAC-SHA256", datetime, scope, sha256hex(canonical)].join("\n");
  const signature = createHmac("sha256", signingKey(creds, date)).update(toSign).digest("hex");
  const { host: _host, ...rest } = headers;
  return {
    ...rest,
    authorization: `AWS4-HMAC-SHA256 Credential=${creds.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

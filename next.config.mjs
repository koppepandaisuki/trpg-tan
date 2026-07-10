/**
 * Stripe セキュリティチェックリスト対応: Web アプリの脆弱性対策として
 * セキュリティヘッダを付与する(docs/stripe-security-checklist.md 参照)。
 *
 * CSP は「壊れないこと」を最優先に、実際に使っている外部接続先だけを許可する:
 *   - Supabase(REST + Realtime websocket): クライアント側 supabase-js が
 *     直接叩く(components/auth/google-button.tsx 等)。
 *   - next/font/google は自前ホスティングなので fonts.googleapis.com 等は不要。
 *   - Stripe / Anthropic はサーバー側(Node runtime)からのみ呼ぶため、
 *     ブラウザの CSP(connect-src 等)には無関係。
 *   - script-src/style-src の 'unsafe-inline' は Next.js のハイドレーション用
 *     インラインスクリプトと Tailwind の inline style 属性のため必要。
 *     厳密化(nonce ベース)は将来課題。
 */

function supabaseOrigin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function buildCsp() {
  const origin = supabaseOrigin();
  const wsOrigin = origin ? origin.replace(/^http/, "ws") : null;
  const connectSrc = ["'self'", origin, wsOrigin].filter(Boolean).join(" ");
  const imgSrc = ["'self'", "data:", "blob:", origin].filter(Boolean).join(" ");

  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imgSrc}`,
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: buildCsp() },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
  async rewrites() {
    return [
      // スマホ(PWA)版 SPA。scripts/build-mobile-app.mjs が public/app/ に
      // 配置した index.html を /app と /app/ で開けるようにする
      // (public 配下はディレクトリ index の自動解決が無いため)。
      { source: "/app", destination: "/app/index.html" },
      { source: "/app/", destination: "/app/index.html" },
    ];
  },
};

export default nextConfig;

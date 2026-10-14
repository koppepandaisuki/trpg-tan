#!/usr/bin/env node
/**
 * Deploy-time env check (runs as part of `prebuild`).
 *
 * 本番ビルド(VERCEL_ENV === "production")では、欠けると全ページ/全書き込みが
 * 壊れる必須 env が揃っているかを検証し、欠けていればビルドを失敗させる。
 * これがないと、例えば NEXT_PUBLIC_SITE_URL 未設定のまま本番デプロイして
 * 全ての状態変更 API が 403(fail-closed)になる、という事故に後で気づく。
 *
 * production 以外(ローカル / Preview)では **警告のみ**でビルドは通す
 * (開発体験を壊さない)。
 */

// 欠けると本番が機能不全になる必須 env。
const REQUIRED = [
  "NEXT_PUBLIC_SITE_URL", // 未設定だと isSameOriginRequest が fail-closed → 全書き込み 403
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

// 未設定でも致命ではないが、本番で無いと機能がオフになるもの(警告のみ)。
const RECOMMENDED = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "CRON_SECRET", // 異常検知 cron の認証(未設定だと cron は 503)
];

const isProd = process.env.VERCEL_ENV === "production";

const missingRequired = REQUIRED.filter((k) => !process.env[k]);
const missingRecommended = RECOMMENDED.filter((k) => !process.env[k]);

for (const k of missingRecommended) {
  console.warn(`[check-env] recommended env not set: ${k}`);
}

if (missingRequired.length === 0) {
  console.log("[check-env] passed");
  process.exit(0);
}

if (isProd) {
  console.error("\n[check-env] production build is missing REQUIRED env:\n");
  for (const k of missingRequired) console.error("  -", k);
  console.error(
    "\nSet these in Vercel → Settings → Environment Variables (Production)," +
      " then redeploy.\n",
  );
  process.exit(1);
}

// 本番以外は警告のみ(ローカル / Preview のビルドは通す)。
console.warn(
  `[check-env] ${missingRequired.length} required env(s) not set` +
    " (allowed outside production): " +
    missingRequired.join(", "),
);
process.exit(0);

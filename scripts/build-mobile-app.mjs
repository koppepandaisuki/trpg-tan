#!/usr/bin/env node
/**
 * スマホ(PWA)版のビルド: apps/desktop のフロントエンド(Vite SPA)を
 * ビルドして web の public/app/ へ配置する。web と同一オリジンの
 * https://<domain>/app/ で配信されるので、/api/* への呼び出しは
 * CORS もクッキーもそのまま通る。
 *
 * `pnpm build`(= Vercel のビルド)の prebuild から呼ばれる。
 * SPA は base:"./"(相対パス)でビルドされるためサブパス配信で壊れない。
 *
 * 必要な環境変数(Vercel にも設定すること):
 *   VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
 *   (NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY と同じ値。未設定でもビルドは
 *    通るが、/app はログイン不可の「未接続」表示になる)
 */
import { execSync } from "node:child_process";
import { rmSync, cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "apps", "desktop", "dist");
const DEST = path.join(ROOT, "public", "app");

// VITE_ 環境変数が無ければ NEXT_PUBLIC_ から引き継ぐ(Vercel で二重設定を不要に)。
const env = { ...process.env };
if (!env.VITE_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_URL) {
  env.VITE_SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
}
if (!env.VITE_SUPABASE_ANON_KEY && env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  env.VITE_SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

console.log("[build-mobile-app] building SPA (apps/desktop) …");
execSync("pnpm --filter desktop build", {
  cwd: ROOT,
  stdio: "inherit",
  env,
});

if (!existsSync(DIST)) {
  console.error("[build-mobile-app] dist not found:", DIST);
  process.exit(1);
}

rmSync(DEST, { recursive: true, force: true });
cpSync(DIST, DEST, { recursive: true });

// web 版のコピーにだけ <base href="/app/"> を注入する。
// Next は /app/ → /app へ 308 で正規化するため、相対パス(./assets/…)が
// /assets/… に解決されて 404 になる。base タグで常に /app/ 起点に固定する
// (デスクトップ(Tauri)の index.html は無変更のまま)。
const indexPath = path.join(DEST, "index.html");
const html = readFileSync(indexPath, "utf8");
if (!html.includes("<base ")) {
  writeFileSync(
    indexPath,
    html.replace("<head>", '<head>\n    <base href="/app/" />'),
  );
}
console.log("[build-mobile-app] copied dist -> public/app (+ <base href>)");

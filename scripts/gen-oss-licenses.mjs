#!/usr/bin/env node
/**
 * 本番依存(Web / デスクトップのフロントエンド)の OSS ライセンス一覧を
 * lib/legal/oss-licenses.json に書き出す。/legal/licenses ページが読む。
 *
 * MIT / BSD / Apache-2.0 / CC-BY 等は、配布物に著作権表示・ライセンスの掲示が
 * 求められるため、依存を足したらこのスクリプトを実行してコミットすること:
 *
 *   pnpm licenses:gen
 *
 * デスクトップアプリの Rust 依存(src-tauri)は別途 cargo-about 等で
 * 一覧を作る(docs/legal/README.md)。
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const raw = execSync("pnpm licenses list --prod --json", {
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
const byLicense = JSON.parse(raw);
const out = [];
for (const [license, pkgs] of Object.entries(byLicense)) {
  for (const p of pkgs) {
    if (p.name.startsWith("@trpg/")) continue; // 自分のワークスペース
    out.push({
      name: p.name,
      versions: p.versions,
      license,
      author: typeof p.author === "string" ? p.author : undefined,
      homepage: p.homepage || undefined,
    });
  }
}
out.sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(
  new URL("../lib/legal/oss-licenses.json", import.meta.url),
  JSON.stringify(out, null, 2) + "\n",
);
console.log(`wrote ${out.length} packages`);

import { NextResponse } from "next/server";

// GitHub Releases のページを経由せず、最新版の setup.exe を直接ダウンロードさせる。
// アセット名にバージョン番号が入る(例: Re-dice_0.1.68_x64-setup.exe)ため、
// 固定URLの `releases/latest/download/{name}` は使えない。そこで:
//   1. 自動更新の目録 latest.json(固定 URL。GitHub API のレート制限を受けない)から
//      インストーラの実 URL を読む
//   2. だめなら GitHub API(未認証は Vercel の共有 IP で制限に当たりやすい)
//   3. それもだめなら Releases のページ
export const revalidate = 1800;

const LATEST_JSON =
  "https://github.com/koppepandaisuki/trpg-tan/releases/latest/download/latest.json";
const RELEASES_API =
  "https://api.github.com/repos/koppepandaisuki/trpg-tan/releases/latest";
const RELEASES_FALLBACK =
  "https://github.com/koppepandaisuki/trpg-tan/releases/latest";

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}

/** latest.json の NSIS(setup.exe)の URL。 */
async function fromManifest(): Promise<string | null> {
  const res = await fetch(LATEST_JSON, { next: { revalidate } });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    platforms?: Record<string, { url?: string }>;
  };
  const url = data.platforms?.["windows-x86_64-nsis"]?.url;
  return url && url.endsWith("-setup.exe") ? url : null;
}

/** GitHub API の最新リリースから setup.exe の URL。 */
async function fromApi(): Promise<string | null> {
  const res = await fetch(RELEASES_API, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "re-dice-web",
    },
    next: { revalidate },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { assets?: ReleaseAsset[] };
  return data.assets?.find((a) => a.name.endsWith("-setup.exe"))?.browser_download_url ?? null;
}

export async function GET() {
  for (const resolve of [fromManifest, fromApi]) {
    try {
      const url = await resolve();
      if (url) return NextResponse.redirect(url);
    } catch {
      // 次の方法へ
    }
  }
  return NextResponse.redirect(RELEASES_FALLBACK);
}

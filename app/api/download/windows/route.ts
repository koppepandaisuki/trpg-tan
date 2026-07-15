import { NextResponse } from "next/server";

// GitHub Releases のページを経由せず、最新版の setup.exe を直接ダウンロードさせる。
// アセット名にバージョン番号が入る(例: Re-dice_0.1.64_x64-setup.exe)ため、
// 固定URLの `releases/latest/download/{name}` は使えず、API から実URLを解決する。
export const revalidate = 1800;

const RELEASES_API =
  "https://api.github.com/repos/koppepandaisuki/trpg-tan/releases/latest";
const RELEASES_FALLBACK =
  "https://github.com/koppepandaisuki/trpg-tan/releases/latest";

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}

export async function GET() {
  try {
    const res = await fetch(RELEASES_API, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "re-dice-web",
      },
      next: { revalidate },
    });
    if (!res.ok) {
      return NextResponse.redirect(RELEASES_FALLBACK);
    }
    const data = (await res.json()) as { assets?: ReleaseAsset[] };
    const asset = data.assets?.find((a) => a.name.endsWith("-setup.exe"));
    if (!asset) {
      return NextResponse.redirect(RELEASES_FALLBACK);
    }
    return NextResponse.redirect(asset.browser_download_url);
  } catch {
    return NextResponse.redirect(RELEASES_FALLBACK);
  }
}

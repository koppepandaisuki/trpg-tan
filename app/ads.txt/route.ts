import { adsensePublisherId } from "@/lib/ads";

/** /ads.txt(AdSense の販売者認証)。広告を設定していなければ 404。 */
export function GET() {
  const pub = adsensePublisherId();
  if (!pub) return new Response("Not Found", { status: 404 });
  return new Response(`google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

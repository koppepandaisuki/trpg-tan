import Script from "next/script";
import { adsenseClient } from "@/lib/ads";

/** AdSense の読み込み(NEXT_PUBLIC_ADSENSE_CLIENT があるときだけ)。 */
export function AdsenseScript() {
  const client = adsenseClient();
  if (!client) return null;
  return (
    <Script
      id="adsense"
      async
      strategy="afterInteractive"
      crossOrigin="anonymous"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
    />
  );
}

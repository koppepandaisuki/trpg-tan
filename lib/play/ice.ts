import "server-only";

/**
 * 卓の P2P 直結に使う ICE サーバー(STUN / TURN)。
 *
 *   - STUN: 無料・無制限の公開サーバー(Cloudflare / Google)。全員に配る。
 *     自前サーバー不要・維持費 0 円で、家庭の回線どうしならほぼこれで直結できる。
 *   - TURN: 直結できない環境(対称型 NAT・企業ネットワーク)でも確実に繋ぐ中継。
 *     Cloudflare Realtime TURN(毎月 1,000GB まで無料、超過 $0.05/GB)の
 *     短期資格情報を発行する。**有料プランの特典**として、環境変数が揃っている
 *     ときだけ有効になる(未設定なら STUN のみ = 従来どおり Supabase 中継へ退避)。
 *
 * TURN の鍵(CLOUDFLARE_TURN_KEY_ID / CLOUDFLARE_TURN_API_TOKEN)はサーバー専用。
 * ブラウザ/アプリには発行済みの短期資格情報だけを渡す。
 */

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export const PUBLIC_STUN: IceServer[] = [
  { urls: "stun:stun.cloudflare.com:3478" },
  { urls: "stun:stun.l.google.com:19302" },
];

/** 資格情報の有効期間(秒)。長い卓でも切れないよう 12 時間。 */
const TURN_TTL_SECONDS = 12 * 60 * 60;

export function isTurnConfigured(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_TURN_KEY_ID && process.env.CLOUDFLARE_TURN_API_TOKEN,
  );
}

/**
 * Cloudflare から TURN の短期資格情報を発行する。失敗したら null
 * (呼び出し側は STUN のみで続行 = 直結できなければ Supabase 中継)。
 */
export async function generateTurnServers(): Promise<IceServer[] | null> {
  const keyId = process.env.CLOUDFLARE_TURN_KEY_ID;
  const token = process.env.CLOUDFLARE_TURN_API_TOKEN;
  if (!keyId || !token) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ttl: TURN_TTL_SECONDS }),
        cache: "no-store",
        signal: ctrl.signal,
      },
    );
    if (!res.ok) {
      console.warn("[ice] TURN 資格情報の発行に失敗", res.status);
      return null;
    }
    const body = (await res.json()) as { iceServers?: IceServer[] };
    return filterBrowserPorts(body.iceServers ?? []);
  } catch (e) {
    console.warn("[ice] TURN 資格情報の発行に失敗", e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * ブラウザが塞いでいるポート 53 の URL を除く(候補を待ち切ってから 1 通で
 * 送る方式なので、繋がらない URL があると収集がタイムアウトまで延びる)。
 */
export function filterBrowserPorts(servers: IceServer[]): IceServer[] {
  return servers
    .map((s) => ({
      ...s,
      urls: (Array.isArray(s.urls) ? s.urls : [s.urls]).filter(
        (u) => !/:53(\?|$)/.test(u),
      ),
    }))
    .filter((s) => s.urls.length > 0);
}

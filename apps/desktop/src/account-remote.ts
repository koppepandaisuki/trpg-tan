import { appFetch as fetch, WEB_BASE } from "./platform";
import { supabase } from "./supabase";

/**
 * アカウント関連で Web API を叩く処理。HTTP は webview の fetch ではなく
 * tauri-plugin-http(Rust 側)を使い CORS の影響を受けない(download.ts と同方針)。
 */

// WEB_BASE は platform.ts(Tauri=env / ブラウザ=同一オリジン相対)

/**
 * 退会(アカウント削除)。本人の JWT を Bearer で /api/account/delete に送る。
 * サーバーが service_role で本人だけを削除する(クライアントには service_role を
 * 一切持たせない)。成功時は呼び出し側でサインアウトする。失敗時はサーバーの
 * メッセージ(作品保有で退会不可 等)を Error として投げる。
 */
export async function deleteMyAccount(confirm: string): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("ログインが必要です。再度ログインしてください。");

  const res = await fetch(`${WEB_BASE}/api/account/delete`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ confirm }),
  });

  let body: { ok?: boolean; message?: string };
  try {
    body = (await res.json()) as { ok?: boolean; message?: string };
  } catch {
    throw new Error(`サーバ応答が不正です (${res.status})`);
  }

  if (!res.ok || !body.ok) {
    throw new Error(body.message ?? `退会処理に失敗しました (${res.status})`);
  }
}

/* ===== 料金プラン(テスター用・課金なし) ===== */

export type UserPlan = "basic" | "play" | "pro";

function normalizePlan(p: unknown): UserPlan {
  return p === "pro" ? "pro" : p === "play" ? "play" : "basic";
}

export type MyAccount = {
  plan: UserPlan;
  isAdmin: boolean;
  /** テスター権限(リデームコード「TESTER」で付与)。Stripe を介さずプラン切替可。 */
  isTester: boolean;
  loggedIn: boolean;
};

/**
 * 最後に取得できたアカウント情報のローカルキャッシュ。
 * オフライン/API 一時障害のとき課金ユーザーが basic に「誤降格」して
 * PLAY ホスト等がゲートされるのを防ぐ(ネットワーク失敗時のみ使用)。
 */
const ACCOUNT_CACHE_KEY = "paradice.account.cache";

function readAccountCache(): MyAccount | null {
  try {
    const raw = localStorage.getItem(ACCOUNT_CACHE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<MyAccount>;
    return {
      plan: normalizePlan(v.plan),
      isAdmin: Boolean(v.isAdmin),
      isTester: Boolean(v.isTester),
      loggedIn: true,
    };
  } catch {
    return null;
  }
}

function writeAccountCache(acct: MyAccount) {
  try {
    localStorage.setItem(ACCOUNT_CACHE_KEY, JSON.stringify(acct));
  } catch {
    // storage 不可(容量等)でも致命ではない。
  }
}

/** サインアウト時に呼ぶ(前アカウントのプランを次のログインへ持ち越さない)。 */
export function clearAccountCache() {
  try {
    localStorage.removeItem(ACCOUNT_CACHE_KEY);
  } catch {
    // no-op
  }
}

/**
 * 現在のアカウント情報(プラン + 管理者か + ログイン有無)を取得。
 * - 未ログイン(token なし) → { plan:"basic", isAdmin:false, loggedIn:false }。
 * - API がエラー応答(401 等) → basic(サーバの判断を尊重)。
 * - ネットワーク失敗(オフライン等) → 最後に成功したキャッシュがあればそれを返す。
 * loggedIn は「未ログイン」と「ログイン済み basic」を区別するために使う
 * (未ログインはプラン案内ではなくログイン誘導を出す)。
 */
export async function getMyAccount(): Promise<MyAccount> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token)
    return { plan: "basic", isAdmin: false, isTester: false, loggedIn: false };
  try {
    const res = await fetch(`${WEB_BASE}/api/account/plan`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as {
      ok?: boolean;
      plan?: string;
      admin?: boolean;
      tester?: boolean;
    };
    if (res.ok && body.ok) {
      const acct: MyAccount = {
        plan: normalizePlan(body.plan),
        isAdmin: Boolean(body.admin),
        isTester: Boolean(body.tester),
        loggedIn: true,
      };
      writeAccountCache(acct);
      return acct;
    }
  } catch {
    // ネットワーク失敗(オフライン等)。最後に成功した値があればそれで継続する。
    const cached = readAccountCache();
    if (cached) return cached;
  }
  return { plan: "basic", isAdmin: false, isTester: false, loggedIn: true };
}

/** 現在のプランだけ取得(未ログイン/失敗時は basic)。 */
export async function getMyPlan(): Promise<UserPlan> {
  return (await getMyAccount()).plan;
}

type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; reason: string; message: string };

/**
 * Stripe Checkout セッションを作成して URL を返す。デスクトップはこの URL を
 * 外部ブラウザで開き、決済後 redice://subscription/complete で戻ってくる。
 */
export async function startPlanCheckout(
  plan: UserPlan,
): Promise<CheckoutResult> {
  if (plan === "basic") throw new Error("basic は無料プランです。");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("ログインが必要です。");
  const res = await fetch(`${WEB_BASE}/api/plan/checkout`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ plan, returnTo: "desktop" }),
  });
  let body: { ok?: boolean; url?: string; reason?: string; message?: string };
  try {
    body = (await res.json()) as typeof body;
  } catch {
    throw new Error(`サーバ応答が不正です (${res.status})`);
  }
  if (res.ok && body.ok && body.url) return { ok: true, url: body.url };
  return {
    ok: false,
    reason: body.reason ?? "server_error",
    message: body.message ?? `申し込みに失敗しました (${res.status})`,
  };
}

/**
 * Stripe Customer Portal セッションを作成して URL を返す。
 * 解約・プラン変更・支払い方法の更新をユーザー自身が行える。
 */
export async function openPlanPortal(): Promise<CheckoutResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("ログインが必要です。");
  const res = await fetch(`${WEB_BASE}/api/plan/portal`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ returnTo: "desktop" }),
  });
  let body: { ok?: boolean; url?: string; message?: string };
  try {
    body = (await res.json()) as typeof body;
  } catch {
    throw new Error(`サーバ応答が不正です (${res.status})`);
  }
  if (res.ok && body.ok && body.url) return { ok: true, url: body.url };
  return {
    ok: false,
    reason: "server_error",
    message: body.message ?? `管理ページを開けませんでした (${res.status})`,
  };
}

export type RedeemResult = {
  kind: "plan_play" | "plan_pro" | "gold" | "tester_access";
  plan?: UserPlan;
  amount?: number;
  goldBalance?: number;
  message: string;
};

/**
 * リデームコードの引き換え(プラン付与 / ゴールド付与)。
 * 失敗はサーバのメッセージ(無効/使用済み等)を Error で投げる。
 */
export async function redeemCode(code: string): Promise<RedeemResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("ログインが必要です。");
  const res = await fetch(`${WEB_BASE}/api/redeem`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code }),
  });
  type RedeemResp = Partial<RedeemResult> & { ok?: boolean; message?: string };
  let body: RedeemResp | null = null;
  try {
    body = (await res.json()) as RedeemResp;
  } catch {
    throw new Error(`サーバ応答が不正です (${res.status})`);
  }
  if (!res.ok || !body?.ok) {
    throw new Error(body?.message ?? `引き換えに失敗しました (${res.status})`);
  }
  return body as RedeemResult;
}

/**
 * テスター用にプランを設定(課金なし)。本人の JWT を Bearer で送り、サーバーが
 * 本人のプランのみ更新する。Stripe Billing 実装後は購入フローに置き換える。
 */
export async function setMyPlanTester(plan: UserPlan): Promise<UserPlan> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("ログインが必要です。");
  const res = await fetch(`${WEB_BASE}/api/account/plan`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ plan }),
  });
  let body: { ok?: boolean; message?: string; plan?: string };
  try {
    body = (await res.json()) as typeof body;
  } catch {
    throw new Error(`サーバ応答が不正です (${res.status})`);
  }
  if (!res.ok || !body.ok) {
    throw new Error(body.message ?? `プラン変更に失敗しました (${res.status})`);
  }
  return normalizePlan(body.plan);
}

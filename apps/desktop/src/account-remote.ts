import { fetch } from "@tauri-apps/plugin-http";
import { supabase } from "./supabase";

/**
 * アカウント関連で Web API を叩く処理。HTTP は webview の fetch ではなく
 * tauri-plugin-http(Rust 側)を使い CORS の影響を受けない(download.ts と同方針)。
 */

const WEB_BASE = (
  import.meta.env.VITE_WEB_BASE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

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

export type MyAccount = { plan: UserPlan; isAdmin: boolean };

/**
 * 現在のアカウント情報(プラン + 管理者か)を取得。未ログイン/失敗時は
 * { plan:"basic", isAdmin:false }。管理者はプラン不問で全機能を使える。
 */
export async function getMyAccount(): Promise<MyAccount> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { plan: "basic", isAdmin: false };
  try {
    const res = await fetch(`${WEB_BASE}/api/account/plan`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as {
      ok?: boolean;
      plan?: string;
      admin?: boolean;
    };
    if (res.ok && body.ok) {
      return { plan: normalizePlan(body.plan), isAdmin: Boolean(body.admin) };
    }
  } catch {
    // 取得失敗は未加入扱い(画面は出す)。
  }
  return { plan: "basic", isAdmin: false };
}

/** 現在のプランだけ取得(未ログイン/失敗時は basic)。 */
export async function getMyPlan(): Promise<UserPlan> {
  return (await getMyAccount()).plan;
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

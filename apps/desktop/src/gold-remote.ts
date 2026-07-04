import { fetch } from "@tauri-apps/plugin-http";
import { useEffect, useState } from "react";
import { supabase } from "./supabase";

/**
 * ゴールド(アプリ内通貨)の Web API 呼び出し + 残高の共有ストア。
 *
 * 残高はモジュールレベルで保持し、購読(useGoldBalance)する各所
 * (ヘッダ / 設定 / ストア)へ即時に伝える。API は tauri-plugin-http を使い
 * CORS を受けない(account-remote.ts と同方針)。
 */

const WEB_BASE = (
  import.meta.env.VITE_WEB_BASE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

export type GoldTx = {
  amount: number;
  kind: string;
  note: string | null;
  createdAt: string;
};

let currentBalance: number | null = null;
const listeners = new Set<(bal: number | null) => void>();

function setBalance(bal: number | null) {
  currentBalance = bal;
  listeners.forEach((cb) => cb(bal));
}

async function authToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("ログインが必要です。");
  return token;
}

/** 残高 + 直近履歴を取得。未ログインなら null 残高。 */
export async function fetchGold(): Promise<{
  balance: number;
  transactions: GoldTx[];
}> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    setBalance(null);
    return { balance: 0, transactions: [] };
  }
  const res = await fetch(`${WEB_BASE}/api/gold/balance`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await res.json()) as {
    ok?: boolean;
    balance?: number;
    transactions?: GoldTx[];
  };
  if (!res.ok || !body.ok) throw new Error(`残高の取得に失敗 (${res.status})`);
  setBalance(body.balance ?? 0);
  return { balance: body.balance ?? 0, transactions: body.transactions ?? [] };
}

/** 残高だけ静かに再取得(表示更新用。失敗は無視)。 */
export async function refreshGold(): Promise<void> {
  try {
    await fetchGold();
  } catch {
    // 表示更新は副次的
  }
}

type ApiError = { reason?: string; message?: string };

async function postJson<T>(
  path: string,
  payload: unknown,
): Promise<{ ok: true; data: T } | { ok: false; error: ApiError; status: number }> {
  const token = await authToken();
  const res = await fetch(`${WEB_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  let body: (T & { ok?: boolean }) & ApiError;
  try {
    body = (await res.json()) as typeof body;
  } catch {
    return { ok: false, status: res.status, error: { message: `サーバ応答が不正です (${res.status})` } };
  }
  if (res.ok && body.ok) return { ok: true, data: body as T };
  return { ok: false, status: res.status, error: body };
}

/** AI 補完(運営キー従量課金)。成功で残高を更新。 */
export async function aiComplete(
  question: string,
  passages: { book: string; text: string }[],
): Promise<
  | { ok: true; text: string; cost: number; balance: number }
  | { ok: false; reason: string; message: string }
> {
  const r = await postJson<{ text: string; cost: number; goldBalance: number }>(
    "/api/ai/complete",
    { question, passages },
  );
  if (r.ok) {
    setBalance(r.data.goldBalance);
    return { ok: true, text: r.data.text, cost: r.data.cost, balance: r.data.goldBalance };
  }
  return {
    ok: false,
    reason: r.error.reason ?? "error",
    message: r.error.message ?? "AI の呼び出しに失敗しました",
  };
}

/** 作品をゴールドで購入。成功で残高を更新。 */
export async function purchaseWithGold(
  productId: string,
): Promise<
  | { ok: true; balance: number }
  | { ok: false; reason: string; message: string }
> {
  const r = await postJson<{ goldBalance: number }>("/api/purchase/gold", {
    productId,
  });
  if (r.ok) {
    setBalance(r.data.goldBalance);
    return { ok: true, balance: r.data.goldBalance };
  }
  return {
    ok: false,
    reason: r.error.reason ?? "error",
    message: r.error.message ?? "購入に失敗しました",
  };
}

/** スーパーサンクス(クリエイターへゴールドを贈る)。成功で残高を更新。 */
export async function sendTip(
  creatorId: string,
  amount: number,
  productId?: string,
  message?: string,
): Promise<
  | { ok: true; balance: number }
  | { ok: false; reason: string; message: string }
> {
  const r = await postJson<{ goldBalance: number }>("/api/tips", {
    creatorId,
    amount,
    productId,
    message,
  });
  if (r.ok) {
    setBalance(r.data.goldBalance);
    return { ok: true, balance: r.data.goldBalance };
  }
  return {
    ok: false,
    reason: r.error.reason ?? "error",
    message: r.error.message ?? "送信に失敗しました",
  };
}

/** ゴールドパックの Stripe Checkout URL を作成(外部ブラウザで開く)。 */
export async function startGoldCheckout(
  pack: "p300" | "p1000" | "p3000",
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const r = await postJson<{ url: string }>("/api/gold/checkout", {
    pack,
    returnTo: "desktop",
  });
  if (r.ok) return { ok: true, url: r.data.url };
  return { ok: false, message: r.error.message ?? "決済を開始できませんでした" };
}

/** React 用: 現在の残高(変更で再レンダー)。null = 未取得/未ログイン。 */
export function useGoldBalance(): number | null {
  const [bal, setBal] = useState<number | null>(currentBalance);
  useEffect(() => {
    listeners.add(setBal);
    setBal(currentBalance);
    return () => {
      listeners.delete(setBal);
    };
  }, []);
  return bal;
}

/** サインアウト時に残高をクリア。 */
export function clearGoldBalance() {
  setBalance(null);
}

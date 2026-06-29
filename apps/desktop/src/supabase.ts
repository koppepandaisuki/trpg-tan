import { createClient } from "@supabase/supabase-js";

/**
 * デスクトップ用 Supabase クライアント。Web と同じプロジェクトの anon key を
 * 使い、PKCE フローでログインする。セッションは WebView の localStorage に
 * 永続(supabase-js 既定)し、自動リフレッシュも効く。
 *
 * 値は Vite の env(apps/desktop/.env: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
 * から読む。未設定でもアプリ(キャラシ)はオフラインで動くので、認証UIだけ
 * 「未設定」表示にフォールバックする。
 */
const url = import.meta.env.VITE_SUPABASE_URL ?? "";
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export const supabaseConfigured = Boolean(url && anon);

// 未設定でも起動だけは通すため、ダミー URL/anon を渡して client を作る
// (createClient は空文字を渡すと throw する)。実際の API 呼び出しは失敗
// するが、ログインUI 等は supabaseConfigured で「未設定」表示にフォロー
// される。env が未指定のリリース版で起動できないのを防ぐ安全網。
export const supabase = createClient(
  url || "https://stub.invalid",
  anon || "stub",
  {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      // deep-link で受け取った URL は自分で exchangeCodeForSession するため、
      // supabase-js による URL 自動検出はオフ。
      detectSessionInUrl: false,
    },
  },
);

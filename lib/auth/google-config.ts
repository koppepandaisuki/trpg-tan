/**
 * Google OAuth の有効/無効フラグ。
 *
 * Supabase Dashboard で Google Provider を有効化 + Google Cloud Console
 * で OAuth 2.0 Client ID を作成するまでは、UI に Google ボタンを出して
 * しまうと「Provider not enabled」エラーがテスターに見える。それを
 * 避けるため、本フラグで UI 側を完全に出し分ける。
 *
 * 設定方法:
 *  - 本番 Vercel:  Environment Variables に
 *      NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=true
 *    を追加(Production / Preview の両方推奨)。再デプロイ後に
 *    Google ボタンが表示される。
 *  - ローカル開発: .env.local に同じ env を書く
 *  - 無効化したいとき: env を削除 or "true" 以外に変更
 *
 * NEXT_PUBLIC_ プレフィクスにより Client Component でも読める
 * (build 時に inline 化される)。値の比較は厳密に "true" のみ。
 */
export const GOOGLE_OAUTH_ENABLED =
  process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED === "true";

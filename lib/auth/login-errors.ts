/**
 * /login?error=... のエラーコードをユーザー向けメッセージに変換する純関数。
 *
 * エラーの出所:
 *   1. 自前の /auth/callback:`missing_code` / `callback_failed`
 *   2. Supabase Auth:`access_denied` + `error_code=otp_expired` 等
 *      (確認メールリンクの期限切れ・無効化)
 *
 * 未知のコードは null を返さず、汎用メッセージを返して
 * 「エラーが起きたことは分かるがどうしてかは分からない」状態を回避する。
 *
 * 純関数。テスト容易。
 */

const ERROR_MESSAGES: Record<string, string> = {
  // 自前 /auth/callback から
  missing_code:
    "認証コードが見つかりませんでした。再度ログインしてください。",
  callback_failed:
    "認証処理中にエラーが発生しました。再度ログインしてください。",

  // Supabase Auth から(代表例)
  otp_expired:
    "確認メールのリンクの有効期限が切れました。改めてサインアップするか、メールアドレスとパスワードで直接ログインしてください。",
  access_denied:
    "アクセスが拒否されました。確認リンクが無効か期限切れの可能性があります。",
  invalid_credentials:
    "メールアドレスかパスワードが間違っています。",
};

export function getLoginErrorMessage(
  error: string | undefined,
  errorCode: string | undefined,
): string | null {
  // error_code が来ていればそれを優先(Supabase は両方付けてくる)
  const key = errorCode || error;
  if (!key) return null;

  const message = ERROR_MESSAGES[key];
  if (message) return message;

  // 未知のコードは汎用メッセージにキー名を併記
  return `エラーが発生しました。再度ログインしてください。(${key})`;
}

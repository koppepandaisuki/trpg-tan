/**
 * α 期間限定の creator メアド whitelist.
 *
 * decisions.md H-001(クリエイター登録フロー)で「公開申請 UI は Phase 2
 * 以降」と保留している間、α テスター追加時に admin が手動で creator 権限を
 * 付与する手間を省くための仕組み。
 *
 * 動作:
 *   - env `ALPHA_AUTO_CREATOR_EMAILS` にカンマ区切りでメアドを列挙
 *   - 該当メアドのユーザーがログインしたら、`lib/session/get-user.ts` が
 *     `autoGrantCreatorIfWhitelisted` を呼んで `is_creator = true` に自動更新
 *   - 既に true なら no-op、env 未設定なら機能オフ
 *
 * α 後の片付け:
 *   - env を Vercel から削除して Redeploy → 機能オフ
 *   - コード自体は残しても害なし(env 未設定なら常に false を返す)
 *   - Phase 2 で creator 申請 UI が実装されたら関連コードごと削除予定
 *
 * 純関数。サーバー / クライアント / テストから自由に import 可能(server-only
 * ガードは付けない)。env 値は呼び出し側で `process.env` から渡すか、デフォ
 * ルトを使う。
 */

/**
 * env 文字列(カンマ区切り)を normalized メアド集合に変換する。
 * - 前後空白を除去
 * - 小文字化
 * - 空文字エントリは除外
 */
export function parseAlphaCreatorEmails(
  envValue: string | undefined,
): Set<string> {
  if (!envValue) return new Set();
  return new Set(
    envValue
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0),
  );
}

/**
 * 指定メアドが α whitelist に含まれているかを判定する。
 * - case-insensitive
 * - env 未設定なら常に false
 * - 空メアドは常に false
 */
export function isAlphaCreatorEmail(
  email: string,
  envValue: string | undefined = process.env.ALPHA_AUTO_CREATOR_EMAILS,
): boolean {
  if (!email) return false;
  const set = parseAlphaCreatorEmails(envValue);
  if (set.size === 0) return false;
  return set.has(email.trim().toLowerCase());
}

/**
 * 指定メアドが α admin whitelist に含まれているかを判定する。
 * creator 版(`isAlphaCreatorEmail`)と同じ仕組み・同じ正規化で、env は
 * `ALPHA_AUTO_ADMIN_EMAILS`(カンマ区切り)。env 未設定なら常に false。
 *
 * 用途: α テスター/運営アカウントに admin 権限(`profiles.is_admin`)を手動 SQL
 * 無しで付与する。`lib/session/get-user.ts` が初回ログイン時に
 * `autoGrantAdminIfWhitelisted` を呼ぶ。env を消せば機能オフ。
 */
export function isAlphaAdminEmail(
  email: string,
  envValue: string | undefined = process.env.ALPHA_AUTO_ADMIN_EMAILS,
): boolean {
  if (!email) return false;
  const set = parseAlphaCreatorEmails(envValue);
  if (set.size === 0) return false;
  return set.has(email.trim().toLowerCase());
}

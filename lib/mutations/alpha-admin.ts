import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAlphaAdminEmail } from "@/lib/access/alpha-whitelist";

/**
 * α 期間限定の admin 自動付与 mutation。
 *
 * `lib/mutations/alpha-creator.ts` の admin 版。env `ALPHA_AUTO_ADMIN_EMAILS`
 * に列挙したメアドのユーザーがログインしたとき、`profiles.is_admin` をまだ
 * false の場合だけ true にする。service_role で UPDATE するため RLS をバイパス。
 *
 * 冪等性:
 *   - email が whitelist に無い → 何もせず false
 *   - 既に is_admin = true → WHERE 句で除外、0 件 = false
 *   - DB エラー → ログのみ、false(ログイン自体は通す)
 *
 * 戻り値: true = この呼び出しで付与した / false = 変更なし。
 */
export async function autoGrantAdminIfWhitelisted(
  userId: string,
  email: string,
): Promise<boolean> {
  if (!isAlphaAdminEmail(email)) {
    return false;
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .update({ is_admin: true })
      .eq("id", userId)
      .eq("is_admin", false) // 既に true なら 0 件 = no-op
      .select("id");

    if (error) {
      console.error("[alpha-auto-admin] grant failed", {
        userId,
        message: error.message,
      });
      return false;
    }

    const granted = (data ?? []).length > 0;
    if (granted) {
      console.info("[alpha-auto-admin] granted", { userId });
    }
    return granted;
  } catch (err) {
    console.error("[alpha-auto-admin] unexpected error", {
      userId,
      err: err instanceof Error ? err.message : "unknown",
    });
    return false;
  }
}

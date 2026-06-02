import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAlphaCreatorEmail } from "@/lib/access/alpha-whitelist";

/**
 * α 期間限定の creator 自動付与 mutation。
 *
 * 呼び出し側(`lib/session/get-user.ts`)が「ログイン済 user の `is_creator`
 * がまだ false」のときだけ呼ぶ前提。service_role 経由で UPDATE するため
 * profiles の RLS / トリガをバイパスする(`is_creator` カラムには
 * 0011_stripe_connect_field_lock のような明示的なクライアント書き込み
 * 禁止トリガはないが、いずれにせよ service_role で書く方針で統一)。
 *
 * 冪等性:
 *   - email が whitelist に無い → 何もせず false を返す
 *   - 既に is_creator = true → WHERE 句で除外、UPDATE は 0 件、false を返す
 *   - DB エラー → ログのみ、false を返す(ログイン自体は通す)
 *
 * 戻り値:
 *   - true: この呼び出しで新たに付与した
 *   - false: 何も変えていない(対象外 or 既に付与済 or エラー)
 */
export async function autoGrantCreatorIfWhitelisted(
  userId: string,
  email: string,
): Promise<boolean> {
  if (!isAlphaCreatorEmail(email)) {
    return false;
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .update({ is_creator: true })
      .eq("id", userId)
      .eq("is_creator", false) // 既に true なら 0 件 = no-op
      .select("id");

    if (error) {
      console.error("[alpha-auto-creator] grant failed", {
        userId,
        message: error.message,
      });
      return false;
    }

    const granted = (data ?? []).length > 0;
    if (granted) {
      console.info("[alpha-auto-creator] granted", { userId });
    }
    return granted;
  } catch (err) {
    // env や Supabase client 初期化失敗等。ログだけ残してログインは継続。
    console.error("[alpha-auto-creator] unexpected error", {
      userId,
      err: err instanceof Error ? err.message : "unknown",
    });
    return false;
  }
}

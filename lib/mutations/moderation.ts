import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { screenProductContent, type ModerationInput } from "@/lib/moderation/ai-screen";

/**
 * 作品を AI で一次審査し、結果を products に書き戻す。
 *
 * - 書き込みは admin client(service role)で行う。AI 判定は admin 向けの
 *   助言なので、creator が書き換えられない経路で残す。
 * - 例外は投げない(出品フローを止めない)。失敗時も ai_verdict='error' 等が
 *   ai-screen 側から返るのでそれを保存する。
 *
 * 呼び出し側(publishAction)は await する想定だが、結果に依存して分岐しない
 * (公開/却下は人間が決める)。
 */
export async function runAiScreening(
  productId: string,
  input: ModerationInput,
): Promise<void> {
  try {
    const result = await screenProductContent(input);
    const admin = createAdminClient();
    const { error } = await admin
      .from("products")
      .update({
        ai_verdict: result.verdict,
        ai_reason: result.reason,
        ai_checked_at: new Date().toISOString(),
      })
      .eq("id", productId);
    if (error) {
      console.error("[runAiScreening] write failed", error.message);
    }
  } catch (e) {
    // ここに来るのは createAdminClient 失敗など。審査は諦めて続行。
    console.error("[runAiScreening] unexpected", e);
  }
}

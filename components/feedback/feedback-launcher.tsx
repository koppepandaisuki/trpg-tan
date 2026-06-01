import { getCurrentUser } from "@/lib/session/get-user";
import { FeedbackButton } from "./feedback-button";

/**
 * Feedback launcher — Server Component。
 *
 * 認証状態を確認して、ログイン済みなら floating button を出す。
 * 未ログインなら null(login / signup / public store では出ない)。
 *
 * α 期間の収集インフラ。decisions.md §7.3 Backlog の B-XX(α 運用
 * フィードバック)で正式エントリ化された。
 */
export async function FeedbackLauncher() {
  const user = await getCurrentUser();
  if (!user) return null;
  return <FeedbackButton />;
}

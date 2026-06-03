"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/session/require";
import {
  profileEditSchema,
  normalizeTwitterHandle,
  type ProfileEditInput,
} from "@/lib/validators/profile";

/**
 * 自分のプロフィール編集 server action。
 *
 * 認証: requireUser(未ログインは redirect)
 * 認可: 自分の profiles 行のみ更新(supabase RLS で creator 自身に限定)
 *
 * フォーム値は zod でバリデート、Twitter ハンドルは server 側で正規化
 * してから保存。
 *
 * 成功時:
 *   - profiles を update
 *   - /account/settings と /creator/[id] を revalidate
 *   - { ok: true } を返す(クライアント側で「保存しました」表示)
 *
 * 失敗時:
 *   - { ok: false, error: string } を返す(クライアント側でエラー表示)
 */
export async function updateProfileAction(
  raw: ProfileEditInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();

  const parsed = profileEditSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "入力に誤りがあります",
    };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      bio: parsed.data.bio,
      twitter_handle: normalizeTwitterHandle(parsed.data.twitterHandle),
      website_url: parsed.data.websiteUrl,
    })
    .eq("id", user.id);

  if (error) {
    console.error("[updateProfileAction] update failed", error);
    return { ok: false, error: "保存に失敗しました。少し時間をおいて再度お試しください。" };
  }

  // 自分のプロフィールページ + 設定ページのキャッシュ無効化。
  // 他人の閲覧は revalidate しない(ISR の負荷を抑える、次回アクセス
  // 時に最新化されるので実用上問題ない)。
  revalidatePath("/account/settings");
  revalidatePath(`/creator/${user.id}`);

  return { ok: true };
}

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
 * アバター画像の Storage への upload 完了後に、profiles.avatar_path を
 * 更新する。client は signed URL に PUT してから本アクションを呼ぶ流れ。
 *
 * path は `<user_id>/<timestamp>.<ext>` 形式を期待。先頭セグメントが
 * 自分の ID と一致するかを server 側でも検証して、他人の path を
 * 書き込み拒否(API route 側で既に決定するが、二重防御)。
 */
export async function updateAvatarPathAction(
  path: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();

  // セキュリティ: path が「自分の id/...」の形であることを確認
  if (!path.startsWith(`${user.id}/`)) {
    return { ok: false, error: "不正なパスです" };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_path: path })
    .eq("id", user.id);

  if (error) {
    console.error("[updateAvatarPathAction] update failed", error);
    return { ok: false, error: "保存に失敗しました" };
  }

  revalidatePath("/account/settings");
  revalidatePath(`/creator/${user.id}`);

  return { ok: true };
}

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

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/session/require";
import {
  profileEditSchema,
  normalizeTwitterHandle,
  sanitizeSocialLinks,
  type ProfileEditInput,
} from "@/lib/validators/profile";
import {
  changePasswordSchema,
  changeEmailSchema,
  type ChangePasswordInput,
  type ChangeEmailInput,
} from "@/lib/validators/auth";
import {
  enrollTotpFactor,
  verifyTotpFactor,
  unenrollTotpFactor,
  type EnrollTotpResult,
  type VerifyTotpResult,
  type UnenrollTotpResult,
} from "@/lib/mutations/mfa";

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
      social_links: sanitizeSocialLinks(parsed.data.socialLinks),
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

/**
 * 設定ページからのパスワード変更。
 *
 * - requireUser() でログイン中前提
 * - 新パスワードと確認用が一致しているか zod で検証
 * - supabase.auth.updateUser({ password }) で更新
 *
 * 「現在のパスワード」の入力は省略(Supabase 標準の updateUser は
 *  既存セッションだけで更新できる)。後日 UX で再認証フローを入れたい
 *  場合はここに password reauth を追加する。
 *
 * 失敗時:
 *  - セッション切れ → 「再ログインしてください」
 *  - その他は汎用メッセージ
 */
export async function changePasswordAction(
  raw: ChangePasswordInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireUser();

  const parsed = changePasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "入力に誤りがあります",
    };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  });

  if (error) {
    console.error("[changePasswordAction] failed", error);
    if (error.message.toLowerCase().includes("session")) {
      return {
        ok: false,
        error: "セッションが切れています。再度ログインしてください。",
      };
    }
    return {
      ok: false,
      error: "パスワードの更新に失敗しました。少し時間をおいて再度お試しください。",
    };
  }

  return { ok: true };
}

/**
 * 設定ページからのメールアドレス変更(ZZZ)。
 *
 * - requireUser() でログイン必須
 * - 新メールアドレスの形式を zod で検証
 * - 現在のメールと同じならエラー(無意味な変更を弾く)
 * - supabase.auth.updateUser({ email }) を呼ぶ
 *   → Supabase が新旧両方のアドレスに確認メールを送る設定の場合、
 *     両方のリンクをクリックするまで変更は確定しない(Secure email change)。
 *     UI 側では「確認メールを送信しました」と案内するだけにする。
 *
 * 失敗時:
 *  - 既に使われているメール等は Supabase のエラーを汎用化(列挙攻撃防止)
 *  - セッション切れは専用文言
 */
export async function changeEmailAction(
  raw: ChangeEmailInput,
): Promise<{ ok: true; sentTo: string } | { ok: false; error: string }> {
  const user = await requireUser();

  const parsed = changeEmailSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "入力に誤りがあります",
    };
  }

  const newEmail = parsed.data.newEmail.toLowerCase();
  if (newEmail === user.email.toLowerCase()) {
    return {
      ok: false,
      error: "現在と同じメールアドレスです。別のアドレスを入力してください。",
    };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ email: newEmail });

  if (error) {
    console.error("[changeEmailAction] failed", error);
    if (error.message.toLowerCase().includes("session")) {
      return {
        ok: false,
        error: "セッションが切れています。再度ログインしてください。",
      };
    }
    return {
      ok: false,
      error:
        "メールアドレスの変更を開始できませんでした。別のアドレスをお試しください。",
    };
  }

  return { ok: true, sentTo: newEmail };
}

/**
 * 二段階認証(TOTP)の任意設定。一般ユーザーの本人確認強化の選択肢として
 * 提供する(Stripe セキュリティチェックリスト「不正ログイン対策」対応)。
 * admin は app/(app)/admin/mfa 側で別途必須化されている。
 */
export async function enrollMfaAction(): Promise<EnrollTotpResult> {
  await requireUser();
  return enrollTotpFactor();
}

export async function verifyMfaAction(input: {
  factorId: string;
  code: string;
}): Promise<VerifyTotpResult> {
  await requireUser();
  const result = await verifyTotpFactor(input.factorId, input.code);
  if (result.ok) revalidatePath("/account/settings");
  return result;
}

export async function unenrollMfaAction(
  factorId: string,
): Promise<UnenrollTotpResult> {
  await requireUser();
  const result = await unenrollTotpFactor(factorId);
  if (result.ok) revalidatePath("/account/settings");
  return result;
}

/**
 * アカウント削除(退会、QQQQQ)。
 *
 * 仕組み:
 *   admin client(service_role)で auth.admin.deleteUser を呼ぶ。
 *   profiles は auth.users への on delete cascade で自動削除される。
 *   purchases.user_id は on delete set null(購入記録は保全)。
 *
 * 制約(初期スキーマの FK 設計):
 *   products.creator_id は profiles への on delete restrict。
 *   → 公開作品 / 下書きを 1 つでも持つ creator は、profiles を削除できず
 *     auth.users 削除も cascade で失敗する。
 *   → その場合は「作品があるため退会できない」旨を案内し、Discord 経由で
 *     個別対応を促す(α 期間の現実解。商品ごと匿名化する完全自動退会は
 *     Phase 2 で creator_id を nullable 化する設計変更が必要)。
 *
 * confirm: クライアントから「退会する」固定文字列を受け取り一致を要求
 *   (誤操作防止。ボタン 1 つで即削除されるのを避ける)。
 *
 * 成功後はクライアント側で sign-out + ホーム遷移する。
 */
const DELETE_CONFIRM_PHRASE = "退会する";

export async function deleteAccountAction(
  confirm: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();

  if (confirm.trim() !== DELETE_CONFIRM_PHRASE) {
    return {
      ok: false,
      error: `確認のため「${DELETE_CONFIRM_PHRASE}」と入力してください。`,
    };
  }

  // 先に「作品を持っているか」を確認して、丁寧なエラーを返す
  // (admin delete が FK restrict で失敗する前に分かりやすく案内)。
  const supabase = createClient();
  const { count: productCount, error: countErr } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", user.id);
  if (countErr) {
    console.error("[deleteAccountAction] product count failed", countErr);
  }
  if ((productCount ?? 0) > 0) {
    return {
      ok: false,
      error:
        "作品を公開・登録中のため退会できません。先にすべての作品を削除するか、Discord にてご相談ください。",
    };
  }

  // admin client で auth.users を削除(profiles は cascade)
  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      console.error("[deleteAccountAction] deleteUser failed", error);
      return {
        ok: false,
        error:
          "退会処理に失敗しました。時間をおいて再度お試しいただくか、Discord にてご相談ください。",
      };
    }
  } catch (err) {
    console.error("[deleteAccountAction] deleteUser threw", err);
    return {
      ok: false,
      error:
        "退会処理に失敗しました。時間をおいて再度お試しいただくか、Discord にてご相談ください。",
    };
  }

  return { ok: true };
}

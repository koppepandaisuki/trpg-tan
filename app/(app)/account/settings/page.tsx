import { Settings } from "lucide-react";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { ProfileEditForm } from "@/components/account/profile-edit-form";
import { AvatarUpload } from "@/components/account/avatar-upload";
import { PasswordChangeForm } from "@/components/account/password-change-form";
import { EmailChangeForm } from "@/components/account/email-change-form";
import { DeleteAccountForm } from "@/components/account/delete-account-form";
import { requireUser } from "@/lib/session/require";
import { createClient } from "@/lib/supabase/server";
import { publicAvatarUrl } from "@/lib/format/storage";
import type { ProfileEditInput } from "@/lib/validators/profile";

export const metadata = { title: "プロフィール設定" };

/**
 * /account/settings — 自分のプロフィール編集ページ。
 *
 * 表示要素:
 *  - hero ヘッダー(Settings アイコン)
 *  - 編集フォーム(表示名 / 自己紹介 / Twitter / Web サイト)
 *
 * 認証必須(requireUser)。
 *
 * 設計判断:
 *  - 編集 UI は左右分割ではなく単一カラムで縦に積む(モバイル UX 優先)
 *  - SNS リンクのみ icon prefix 付きで強調(α テスターに「新機能」を
 *    伝えるための視覚的フック)
 */
export default async function AccountSettingsPage() {
  const user = await requireUser();

  // profiles から現在値を取得(getCurrentUser は SNS / avatar フィールドを
  // 持っていないので、ここで直接 fetch)
  const supabase = createClient();
  const { data: profileRow } = await supabase
    .from("profiles")
    .select(
      "display_name, bio, twitter_handle, website_url, social_links, avatar_path",
    )
    .eq("id", user.id)
    .maybeSingle();

  const initialValues: ProfileEditInput = {
    displayName: profileRow?.display_name ?? "",
    bio: profileRow?.bio ?? "",
    twitterHandle: profileRow?.twitter_handle ?? "",
    websiteUrl: profileRow?.website_url ?? "",
    socialLinks: Array.isArray(profileRow?.social_links)
      ? (profileRow.social_links as { label: string; url: string }[])
      : [],
  };

  const avatarUrl = publicAvatarUrl(profileRow?.avatar_path ?? null);

  return (
    <>
      <TopHeader />
      <PageContainer className="space-y-6 py-8">
        <Breadcrumb
          items={[{ label: "プロフィール設定", icon: Settings }]}
        />

        {/* Hero ヘッダー(他のページと同じ視覚言語、indigo/violet トーン)*/}
        <Card className="overflow-hidden border-border bg-gradient-to-br from-sky-500/8 via-transparent to-violet-500/8 shadow-sm">
          <CardContent className="relative py-5 sm:py-6">
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-violet-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-12 -left-10 h-36 w-36 rounded-full bg-sky-500/10 blur-3xl" />

            <div className="relative z-10 flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-sky-300 bg-sky-50 text-sky-700">
                <Settings className="h-5 w-5" aria-hidden />
              </div>
              <div className="flex-1 space-y-1.5">
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  プロフィール設定
                </h1>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  表示名 / 自己紹介 / SNS リンクを編集できます。クリエイタープロフィールページ
                  (<code className="rounded-sm bg-muted px-1 py-0.5 text-xs">/creator/{user.id.slice(0, 8)}…</code>)
                  に反映されます。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* アバター画像(専用カードで先頭に。即時アップロード式)*/}
        <Card className="shadow-sm">
          <CardContent className="space-y-3 py-5">
            <h2 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              アバター画像
            </h2>
            <AvatarUpload
              initialUrl={avatarUrl}
              initialDisplayName={initialValues.displayName}
            />
          </CardContent>
        </Card>

        {/* 編集フォーム(表示名 / 自己紹介 / SNS)*/}
        <Card className="shadow-sm">
          <CardContent className="py-6">
            <ProfileEditForm initialValues={initialValues} />
          </CardContent>
        </Card>

        {/* メールアドレス変更(ZZZ)*/}
        <Card className="shadow-sm">
          <CardContent className="space-y-3 py-6">
            <div>
              <h2 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                アカウント
              </h2>
              <p className="mt-0.5 text-base font-semibold tracking-tight">
                メールアドレスの変更
              </p>
            </div>
            <EmailChangeForm currentEmail={user.email} />
          </CardContent>
        </Card>

        {/* パスワード変更(AAAA)*/}
        <Card className="shadow-sm">
          <CardContent className="space-y-3 py-6">
            <div>
              <h2 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                セキュリティ
              </h2>
              <p className="mt-0.5 text-base font-semibold tracking-tight">
                パスワードの変更
              </p>
            </div>
            <PasswordChangeForm />
          </CardContent>
        </Card>

        {/* 退会(QQQQQ): danger zone。rose 系の枠で危険操作を視覚化。 */}
        <Card className="border-rose-200 shadow-sm">
          <CardContent className="space-y-3 py-6">
            <div>
              <h2 className="text-[10px] font-semibold uppercase tracking-wider text-rose-600">
                Danger Zone
              </h2>
              <p className="mt-0.5 text-base font-semibold tracking-tight">
                退会する
              </p>
            </div>
            <DeleteAccountForm />
          </CardContent>
        </Card>
      </PageContainer>
    </>
  );
}

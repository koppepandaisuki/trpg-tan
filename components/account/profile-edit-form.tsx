"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Twitter, Globe, CheckCircle2 } from "lucide-react";
import {
  profileEditSchema,
  type ProfileEditInput,
} from "@/lib/validators/profile";
import { updateProfileAction } from "@/app/(app)/account/settings/actions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface ProfileEditFormProps {
  initialValues: ProfileEditInput;
}

/**
 * 自分のプロフィール編集フォーム。
 *
 * react-hook-form + zod。送信後は「保存しました」を 3 秒表示。
 * server action が失敗したら setError("root") でエラーバナー。
 *
 * Twitter ハンドルと URL は icon prefix 付きの input にして、入力欄が
 * 何用なのかを視覚的に明確化。
 */
export function ProfileEditForm({ initialValues }: ProfileEditFormProps) {
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileEditInput>({
    resolver: zodResolver(profileEditSchema),
    defaultValues: initialValues,
  });

  async function onSubmit(values: ProfileEditInput) {
    const result = await updateProfileAction(values);
    if (!result.ok) {
      setError("root", { message: result.error });
      return;
    }
    setSavedAt(Date.now());
    // 3 秒で「保存しました」を消す
    setTimeout(() => setSavedAt(null), 3000);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {/* 表示名 */}
      <div className="space-y-1.5">
        <label htmlFor="displayName" className="text-sm font-medium">
          表示名
        </label>
        <Input
          id="displayName"
          type="text"
          maxLength={50}
          aria-invalid={!!errors.displayName}
          {...register("displayName")}
        />
        <p className="text-xs text-muted-foreground">
          ストアや作品ページに表示される名前(50 文字以下)
        </p>
        {errors.displayName && (
          <p className="text-xs text-destructive">{errors.displayName.message}</p>
        )}
      </div>

      {/* 自己紹介 */}
      <div className="space-y-1.5">
        <label htmlFor="bio" className="text-sm font-medium">
          自己紹介
        </label>
        <Textarea
          id="bio"
          rows={4}
          maxLength={500}
          placeholder="作風 / 得意ジャンル / 自己紹介など"
          aria-invalid={!!errors.bio}
          {...register("bio")}
        />
        <p className="text-xs text-muted-foreground">
          クリエイタープロフィールに表示されます(500 文字以下)
        </p>
        {errors.bio && (
          <p className="text-xs text-destructive">{errors.bio.message}</p>
        )}
      </div>

      {/* Twitter / X */}
      <div className="space-y-1.5">
        <label
          htmlFor="twitterHandle"
          className="flex items-center gap-1.5 text-sm font-medium"
        >
          <Twitter className="h-3.5 w-3.5 text-sky-600" aria-hidden />
          Twitter / X
        </label>
        <Input
          id="twitterHandle"
          type="text"
          maxLength={50}
          placeholder="@your_handle"
          aria-invalid={!!errors.twitterHandle}
          {...register("twitterHandle")}
        />
        <p className="text-xs text-muted-foreground">
          ハンドル名(@抜きでも、URL でも自動で正規化されます)
        </p>
        {errors.twitterHandle && (
          <p className="text-xs text-destructive">
            {errors.twitterHandle.message}
          </p>
        )}
      </div>

      {/* Web サイト */}
      <div className="space-y-1.5">
        <label
          htmlFor="websiteUrl"
          className="flex items-center gap-1.5 text-sm font-medium"
        >
          <Globe className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
          Web サイト
        </label>
        <Input
          id="websiteUrl"
          type="url"
          maxLength={200}
          placeholder="https://example.com"
          aria-invalid={!!errors.websiteUrl}
          {...register("websiteUrl")}
        />
        <p className="text-xs text-muted-foreground">
          自分のサイト / ブログ / pixiv 等(http:// または https://)
        </p>
        {errors.websiteUrl && (
          <p className="text-xs text-destructive">
            {errors.websiteUrl.message}
          </p>
        )}
      </div>

      {errors.root && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {errors.root.message}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          variant="primary"
          disabled={isSubmitting || !isDirty}
        >
          {isSubmitting ? "保存中…" : "保存する"}
        </Button>
        {savedAt && (
          <span
            role="status"
            aria-live="polite"
            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700"
          >
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            保存しました
          </span>
        )}
      </div>
    </form>
  );
}

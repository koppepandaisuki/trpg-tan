"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Lock } from "lucide-react";
import {
  changePasswordSchema,
  type ChangePasswordInput,
} from "@/lib/validators/auth";
import { changePasswordAction } from "@/app/(app)/account/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * 設定ページからのパスワード変更フォーム。
 *
 * フィールド:
 *  - newPassword: 8 文字以上(共通の passwordSchema)
 *  - confirmPassword: 一致確認(zod の refine で検証)
 *
 * 成功時に「パスワードを更新しました」を 3 秒表示、入力欄をクリア。
 * 失敗時はインラインエラー。
 */
export function PasswordChangeForm() {
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(values: ChangePasswordInput) {
    const result = await changePasswordAction(values);
    if (!result.ok) {
      setError("root", { message: result.error });
      return;
    }
    setSavedAt(Date.now());
    reset({ newPassword: "", confirmPassword: "" });
    setTimeout(() => setSavedAt(null), 3000);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div className="space-y-1.5">
        <label
          htmlFor="newPassword"
          className="flex items-center gap-1.5 text-sm font-medium"
        >
          <Lock className="h-3.5 w-3.5 text-violet-600" aria-hidden />
          新しいパスワード
        </label>
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.newPassword}
          {...register("newPassword")}
        />
        <p className="text-xs text-muted-foreground">8 文字以上で設定してください</p>
        {errors.newPassword && (
          <p className="text-xs text-destructive">
            {errors.newPassword.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="confirmPassword"
          className="text-sm font-medium"
        >
          確認用(再入力)
        </label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.confirmPassword}
          {...register("confirmPassword")}
        />
        {errors.confirmPassword && (
          <p className="text-xs text-destructive">
            {errors.confirmPassword.message}
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
          disabled={isSubmitting}
        >
          {isSubmitting ? "更新中…" : "パスワードを更新"}
        </Button>
        {savedAt && (
          <span
            role="status"
            aria-live="polite"
            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700"
          >
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            更新しました
          </span>
        )}
      </div>
    </form>
  );
}

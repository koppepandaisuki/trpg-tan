"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/lib/validators/auth";
import { resetPasswordAction } from "@/app/reset-password/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * 新パスワード入力フォーム。/auth/callback 経由でセッションが立った状態を
 * 前提とする。成功時は「完了」ビューに切り替え、ログインページへの
 * 戻り導線を提示する。
 */
export function ResetPasswordForm() {
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "" },
  });

  async function onSubmit(values: ResetPasswordInput) {
    const result = await resetPasswordAction(values);
    if (!result.ok) {
      setError("root", { message: result.error });
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="space-y-4">
        <div className="space-y-2 rounded-md border border-emerald-200 bg-emerald-50/60 px-4 py-4 text-sm">
          <div className="flex items-start gap-2 text-emerald-900">
            <CheckCircle2
              className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"
              aria-hidden
            />
            <div>
              <p className="font-medium">パスワードを更新しました</p>
              <p className="mt-1 text-xs leading-relaxed text-emerald-800/80">
                新しいパスワードでログインできます。
              </p>
            </div>
          </div>
        </div>
        <Link
          href="/login"
          className={cn(buttonVariants({ variant: "primary" }), "w-full")}
        >
          ログイン画面へ
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          新しいパスワード
        </label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          {...register("password")}
        />
        <p className="text-xs text-muted-foreground">
          8文字以上で設定してください
        </p>
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password.message}</p>
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

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "保存中…" : "パスワードを更新"}
      </Button>
    </form>
  );
}

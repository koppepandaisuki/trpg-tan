"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/validators/auth";
import { forgotPasswordAction } from "@/app/forgot-password/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * パスワードリセットメール送信フォーム。
 *
 * 成功時はフォームを差し替えて「メールを送信しました」の確認ビューに
 * 切替。テスターが「送信ボタン押したけど何も起きてない?」と思わない
 * ように、明示的なフィードバック画面に切替える設計。
 *
 * 列挙攻撃防止のため、未登録メアドでも成功ビューを出す(server 側で
 * 同じ応答を返している)。
 */
export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordInput) {
    const result = await forgotPasswordAction(values);
    if (!result.ok) {
      setError("root", { message: result.error });
      return;
    }
    setSentTo(values.email);
  }

  if (sentTo) {
    return (
      <div className="space-y-3 rounded-md border border-emerald-200 bg-emerald-50/60 px-4 py-4 text-sm">
        <div className="flex items-start gap-2 text-emerald-900">
          <CheckCircle2
            className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"
            aria-hidden
          />
          <div className="space-y-1">
            <p className="font-medium">確認メールを送信しました</p>
            <p className="text-xs leading-relaxed text-emerald-800/80">
              <span className="font-mono">{sentTo}</span> 宛にパスワード再設定の
              リンクを送りました。メール内のリンクをクリックして、新しいパスワードを
              設定してください。
            </p>
            <p className="text-xs leading-relaxed text-emerald-800/80">
              数分待ってもメールが届かない場合は、迷惑メールフォルダもご確認ください。
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          メールアドレス
        </label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
        <p className="text-xs text-muted-foreground">
          登録時のメールアドレスを入力してください
        </p>
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email.message}</p>
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
        {isSubmitting ? "送信中…" : "再設定リンクを送信"}
      </Button>
    </form>
  );
}

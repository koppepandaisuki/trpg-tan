"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, CheckCircle2 } from "lucide-react";
import {
  changeEmailSchema,
  type ChangeEmailInput,
} from "@/lib/validators/auth";
import { changeEmailAction } from "@/app/(app)/account/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * 設定ページからのメールアドレス変更フォーム(ZZZ)。
 *
 * - 現在のメールアドレスを表示(読み取り専用)
 * - 新メールアドレスを入力 → 変更をリクエスト
 * - 成功時は「確認メールを送信しました」ビューに切替
 *   (Secure email change の場合、新旧両方のアドレスにメールが届く)
 */
interface EmailChangeFormProps {
  currentEmail: string;
}

export function EmailChangeForm({ currentEmail }: EmailChangeFormProps) {
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangeEmailInput>({
    resolver: zodResolver(changeEmailSchema),
    defaultValues: { newEmail: "" },
  });

  async function onSubmit(values: ChangeEmailInput) {
    const result = await changeEmailAction(values);
    if (!result.ok) {
      setError("root", { message: result.error });
      return;
    }
    setSentTo(result.sentTo);
  }

  if (sentTo) {
    return (
      <div className="space-y-2 rounded-md border border-emerald-200 bg-emerald-50/60 px-4 py-4 text-sm">
        <div className="flex items-start gap-2 text-emerald-900">
          <CheckCircle2
            className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"
            aria-hidden
          />
          <div className="space-y-1">
            <p className="font-medium">確認メールを送信しました</p>
            <p className="text-xs leading-relaxed text-emerald-800/80">
              <span className="font-mono">{sentTo}</span> に確認メールを送りました。
              メール内のリンクをクリックすると変更が完了します。
            </p>
            <p className="text-xs leading-relaxed text-emerald-800/80">
              セキュリティのため、現在のメールアドレスにも通知が届く場合があります。
              リンクをクリックするまで現在のアドレスでログインできます。
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {/* 現在のメール(読み取り専用)*/}
      <div className="space-y-1.5">
        <span className="text-sm font-medium">現在のメールアドレス</span>
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          {currentEmail}
        </p>
      </div>

      {/* 新メール */}
      <div className="space-y-1.5">
        <label
          htmlFor="newEmail"
          className="flex items-center gap-1.5 text-sm font-medium"
        >
          <Mail className="h-3.5 w-3.5 text-sky-600" aria-hidden />
          新しいメールアドレス
        </label>
        <Input
          id="newEmail"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.newEmail}
          {...register("newEmail")}
        />
        <p className="text-xs text-muted-foreground">
          変更には新しいアドレス宛の確認メールのリンククリックが必要です
        </p>
        {errors.newEmail && (
          <p className="text-xs text-destructive">{errors.newEmail.message}</p>
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

      <Button type="submit" variant="primary" disabled={isSubmitting}>
        {isSubmitting ? "送信中…" : "確認メールを送信"}
      </Button>
    </form>
  );
}

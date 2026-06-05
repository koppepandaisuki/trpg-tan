"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema, type SignupInput } from "@/lib/validators/auth";
import { signupAction } from "@/app/signup/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GoogleButton } from "@/components/auth/google-button";
import { GOOGLE_OAUTH_ENABLED } from "@/lib/auth/google-config";

export function SignupForm() {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      password: "",
      displayName: "",
      agreedToTerms: false,
    },
  });

  async function onSubmit(values: SignupInput) {
    const result = await signupAction(values);
    if (result?.error) {
      setError("root", { message: result.error });
    }
  }

  return (
    <div className="space-y-4">
      {/* Google でのサインアップは、Supabase Dashboard で Provider が
          有効化されているときだけ表示。env NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED
          を「true」にしたタイミングで一括ロールアウト。 */}
      {GOOGLE_OAUTH_ENABLED && (
        <>
          <GoogleButton label="Google で新規登録" />
          {/* OAuth は server action の checkbox 検証を通らないので、
              暗黙同意の注記を出す(主要サービスと同じ慣行)。 */}
          <p className="text-center text-[10px] leading-relaxed text-muted-foreground">
            Google で登録すると <TermsLinks /> に同意したものとみなされます
          </p>

          <div
            className="relative my-2 flex items-center"
            role="separator"
            aria-label="または"
          >
            <div className="flex-1 border-t border-border" aria-hidden />
            <span className="px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              または
            </span>
            <div className="flex-1 border-t border-border" aria-hidden />
          </div>
        </>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <label htmlFor="displayName" className="text-sm font-medium">
          表示名
        </label>
        <Input
          id="displayName"
          type="text"
          autoComplete="nickname"
          aria-invalid={!!errors.displayName}
          {...register("displayName")}
        />
        {errors.displayName && (
          <p className="text-xs text-destructive">{errors.displayName.message}</p>
        )}
      </div>

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
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          パスワード
        </label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          {...register("password")}
        />
        <p className="text-xs text-muted-foreground">8文字以上で設定してください。</p>
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>

      {/* 利用規約同意チェック(TTTTT) */}
      <div className="space-y-1">
        <label className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-foreground focus:ring-ring"
            aria-invalid={!!errors.agreedToTerms}
            {...register("agreedToTerms")}
          />
          <span>
            <TermsLinks /> に同意します
          </span>
        </label>
        {errors.agreedToTerms && (
          <p className="text-xs text-destructive">
            {errors.agreedToTerms.message}
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

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting
          ? "登録中…"
          : GOOGLE_OAUTH_ENABLED
            ? "メールで新規登録"
            : "新規登録"}
      </Button>
      </form>
    </div>
  );
}

/**
 * 利用規約 / プライバシーポリシーへのリンク(別タブで開く)。
 * 同意チェックの文言内とOAuth 注記の両方で再利用。
 */
function TermsLinks() {
  return (
    <>
      <Link
        href="/terms"
        target="_blank"
        className="text-accent underline-offset-2 hover:underline"
      >
        利用規約
      </Link>
      {" ・ "}
      <Link
        href="/privacy"
        target="_blank"
        className="text-accent underline-offset-2 hover:underline"
      >
        プライバシーポリシー
      </Link>
    </>
  );
}

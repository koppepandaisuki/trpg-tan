"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import { loginSchema, type LoginInput } from "@/lib/validators/auth";
import { loginAction } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GoogleButton } from "@/components/auth/google-button";

export function LoginForm() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/";

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    const result = await loginAction(values, nextPath);
    if (!result.ok) {
      setError("root", { message: result.error });
      return;
    }
    // Hard navigation on success. Required so the browser fully commits
    // the auth cookies set by the Server Action before the next request
    // hits middleware (avoiding a known soft-nav race that produces a
    // /login → /target → /login loop). See app/login/actions.ts.
    window.location.href = result.redirectTo;
  }

  return (
    <div className="space-y-4">
      {/* Google ログインを先に出す。signup ページと同じ理由(クリック 1 回 UX)*/}
      <GoogleButton label="Google で続行" />

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
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          {...register("password")}
        />
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
        {isSubmitting ? "ログイン中…" : "メールでログイン"}
      </Button>
      </form>
    </div>
  );
}

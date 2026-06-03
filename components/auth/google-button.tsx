"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

/**
 * Google で続行 / Google で新規登録ボタン。
 *
 * Supabase Auth の signInWithOAuth を呼び、Google の OAuth 同意画面に
 * リダイレクトする。同意後は Supabase が `/auth/callback?code=...` に
 * 戻してくれ、既存の app/auth/callback/route.ts が
 * exchangeCodeForSession でセッション確立 → 内部 next path へ遷移する。
 *
 * 注意:
 *  - signup と login のどちらから呼ばれても挙動は同じ
 *    (Supabase 側で「初回ログイン = サインアップ」として users に
 *     レコード追加、2 回目以降は既存ユーザーとしてログイン)
 *  - `?next=` クエリがあれば redirectTo に含めて、callback 後の
 *    遷移先として尊重する
 *  - α 期間中は signup ページで auto-creator 付与の処理が走るが、
 *    OAuth で参加した user も auto-grant ホワイトリストに対象なら
 *    creator 権限が付与される(getCurrentUser 経由)
 *
 * Supabase Dashboard 側で Google Provider 有効化と Google Cloud
 * Console での OAuth 2.0 クライアント ID 作成が必要。詳細は本 PR の
 * description 参照。
 */
interface GoogleButtonProps {
  /** ボタンのラベル(signup ページなら「Google で新規登録」など) */
  label?: string;
}

export function GoogleButton({ label = "Google で続行" }: GoogleButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();

  async function handleClick() {
    setLoading(true);
    setError(null);

    const supabase = createClient();

    // callback 後の遷移先: `?next=` クエリ優先、なければ /library
    const next = searchParams.get("next") ?? "/library";

    // redirectTo は OAuth provider が完了後に飛ばす URL。
    // Supabase はここに ?code= を付けて返してくれる。
    // window.location.origin で本番 / preview / local すべてに対応。
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        // queryParams: { access_type: "offline", prompt: "consent" },
        // ↑ refresh token が必要な場合(現状は不要)
      },
    });

    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
      return;
    }
    // 成功時は Supabase が外部リダイレクトを始めるため、ここで spinner
    // を表示し続ける(setLoading(false) は呼ばない)
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        onClick={handleClick}
        disabled={loading}
        aria-label="Google アカウントで続行"
      >
        <GoogleIcon className="h-4 w-4" />
        {loading ? "Google に移動中…" : label}
      </Button>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
        >
          Google ログインに失敗しました: {error}
        </p>
      )}
    </div>
  );
}

/**
 * Google 公式の "G" アイコンを SVG で再現。lucide には Google ロゴが
 * 無いため、Google ブランドガイドラインに準じた多色 G ロゴを描く。
 */
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      className={className}
      aria-hidden
    >
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

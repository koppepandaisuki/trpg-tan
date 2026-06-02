import { FlaskConical } from "lucide-react";
import { isStripeTestMode } from "@/lib/stripe/mode";

/**
 * Stripe Test mode のとき画面上部に常時表示するバナー。
 *
 * α テスターが「ここは本番のように見えるが実カードでは決済できない /
 * 個人情報は登録しない方が良い」という認識を持つために必要。
 *
 * Live mode 切替時に自動で消える(STRIPE_SECRET_KEY が `sk_live_` になる)。
 * 切替時に手動でコード削除する必要はない。
 *
 * Server Component。env を直接読むのでクライアントバンドルに混入しない。
 */
export function TestModeBanner() {
  if (!isStripeTestMode()) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <div className="mx-auto flex max-w-screen-2xl items-start gap-2 px-4 py-2 text-xs text-amber-900 sm:items-center sm:px-6 sm:text-sm">
        <FlaskConical
          className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 sm:mt-0"
          aria-hidden
        />
        <p>
          <strong>α テスト環境です。</strong>
          Stripe Test mode で動作中。決済テストは
          <code className="mx-1 rounded bg-amber-100 px-1 py-0.5 font-mono text-[11px]">
            4242 4242 4242 4242
          </code>
          のテストカードを使ってください。<strong>実カードは決済が走りません。</strong>
          個人情報・実物の本人確認書類は登録しないでください(α 終了時にデータがリセットされる可能性があります)。
        </p>
      </div>
    </div>
  );
}

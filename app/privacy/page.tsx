import { ShieldCheck } from "lucide-react";
import { LegalLayout, LegalSection } from "@/components/legal/legal-layout";

export const metadata = { title: "プライバシーポリシー" };

/**
 * プライバシーポリシー(暫定版)。α 期間中の最小限の方針。
 */
export default function PrivacyPage() {
  return (
    <LegalLayout
      title="プライバシーポリシー"
      icon={ShieldCheck}
      lastUpdated="2026-06-05"
    >
      <p>
        Re-dice TRPGサイト(以下「本サービス」)は、利用者の個人情報を以下の方針に
        基づいて取り扱います。
      </p>

      <LegalSection heading="1. 取得する情報">
        <p>本サービスは、以下の情報を取得します。</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>メールアドレス(アカウント登録時)</li>
          <li>表示名・自己紹介・アバター画像等のプロフィール情報</li>
          <li>決済情報(Stripe を通じて処理。カード番号等は本サービスに保存されません)</li>
          <li>アクセスログ・利用状況等の情報</li>
        </ul>
      </LegalSection>

      <LegalSection heading="2. 利用目的">
        <p>取得した情報は、以下の目的で利用します。</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>本サービスの提供・運営</li>
          <li>利用者の認証およびアカウント管理</li>
          <li>決済処理および売上の精算</li>
          <li>お問い合わせ対応・不正利用の防止</li>
          <li>サービス改善のための分析</li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. 第三者提供">
        <p>
          本サービスは、法令に基づく場合を除き、利用者の同意なく個人情報を
          第三者に提供しません。ただし、決済処理のため Stripe 等の決済事業者に
          必要な情報を提供する場合があります。
        </p>
      </LegalSection>

      <LegalSection heading="4. 外部サービスの利用">
        <p>
          本サービスは、認証・データ保管に Supabase、決済に Stripe、ホスティングに
          Vercel を利用しています。これらのサービスにおける情報の取り扱いは、
          各サービスのプライバシーポリシーに従います。
        </p>
      </LegalSection>

      <LegalSection heading="5. データの保管・削除">
        <p>
          利用者は、アカウント設定ページからいつでも退会(アカウント削除)できます。
          退会時にはプロフィール情報等が削除されます。なお、取引記録は法令上の
          保存義務および運用監査のため、匿名化したうえで一定期間保管される場合が
          あります。
        </p>
      </LegalSection>

      <LegalSection heading="6. Cookie・ローカルストレージ">
        <p>
          本サービスは、ログイン状態の維持やお気に入り・閲覧履歴の保存のために
          Cookie およびブラウザのローカルストレージを使用します。お気に入りや
          閲覧履歴はお使いの端末内にのみ保存され、サーバーには送信されません。
        </p>
      </LegalSection>

      <LegalSection heading="7. お問い合わせ">
        <p>
          個人情報の取り扱いに関するお問い合わせは、本サービスの Discord
          コミュニティを通じて受け付けています。
        </p>
      </LegalSection>
    </LegalLayout>
  );
}

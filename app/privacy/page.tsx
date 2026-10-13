import Link from "next/link";
import type { Route } from "next";
import { ShieldCheck } from "lucide-react";
import { LegalLayout, LegalSection } from "@/components/legal/legal-layout";
import { ContactInfo } from "@/components/legal/contact-info";
import {
  DISCLOSE_ON_REQUEST,
  LEGAL_UPDATED_AT,
  SERVICE_NAME,
  getOperator,
} from "@/lib/legal/operator";

export const metadata = { title: "プライバシーポリシー" };

/**
 * プライバシーポリシー。
 *
 * 個人情報保護法(2022 年改正: 保有個人データに関する事項の公表・外国にある
 * 第三者への提供・安全管理措置の公表)と、電気通信事業法の外部送信規律
 * (27 条の 12)の公表事項を含む。外部送信先を追加・変更したら §6 の表を更新すること
 * (広告を入れるときは特に)。根拠と残課題は docs/legal/README.md。
 */

type ExternalTransmission = {
  to: string;
  purpose: string;
  data: string;
  policy: string;
  when: string;
};

const EXTERNAL: ExternalTransmission[] = [
  {
    to: "Supabase, Inc.(米国)",
    purpose: "ログイン、データの保存、卓の通信の中継・接続の段取り",
    data: "認証情報(アクセストークン)、操作内容、IP アドレス、ブラウザ情報",
    policy: "https://supabase.com/privacy",
    when: "常時",
  },
  {
    to: "Vercel, Inc.(米国)",
    purpose: "ウェブサイトの配信",
    data: "IP アドレス、閲覧したページ、ブラウザ情報",
    policy: "https://vercel.com/legal/privacy-policy",
    when: "常時",
  },
  {
    to: "Cloudflare, Inc.(米国)/ Google LLC(米国)",
    purpose: "卓の直結(P2P)のための接続先確認(STUN)",
    data: "IP アドレス、ポート番号",
    policy: "https://www.cloudflare.com/privacypolicy/ / https://policies.google.com/privacy",
    when: "卓に入ったとき(直結を使う設定のとき)",
  },
  {
    to: "Cloudflare, Inc.(米国)",
    purpose: "卓の通信の中継(TURN。有料プランで提供する場合)",
    data: "IP アドレス、卓の通信内容(暗号化された状態で中継)",
    policy: "https://www.cloudflare.com/privacypolicy/",
    when: "有料プランで中継を使うとき",
  },
  {
    to: "Stripe, Inc.(米国)",
    purpose: "料金プラン・ゴールドの決済",
    data: "決済に必要な情報(カード情報は Stripe が直接取得)、メールアドレス",
    policy: "https://stripe.com/jp/privacy",
    when: "決済画面を開いたとき",
  },
  {
    to: "Google LLC(米国)",
    purpose: "Google アカウントでのログイン",
    data: "認証に必要な情報",
    policy: "https://policies.google.com/privacy",
    when: "Google でログインするとき",
  },
];

export default function PrivacyPage() {
  const op = getOperator();
  return (
    <LegalLayout
      title="プライバシーポリシー"
      icon={ShieldCheck}
      lastUpdated={LEGAL_UPDATED_AT}
    >
      <p>
        {SERVICE_NAME}(以下「本サービス」)の運営者(以下「運営者」)は、利用者の
        個人情報を、個人情報の保護に関する法律その他の関係法令に従い、以下のとおり
        取り扱います。
      </p>

      <LegalSection heading="1. 事業者の情報">
        <ul className="list-disc space-y-1 pl-5">
          <li>名称(氏名): {op.name ?? DISCLOSE_ON_REQUEST}</li>
          <li>住所: {op.address ?? DISCLOSE_ON_REQUEST}</li>
          <li>運営責任者: {op.representative ?? DISCLOSE_ON_REQUEST}</li>
        </ul>
      </LegalSection>

      <LegalSection heading="2. 取得する情報">
        <ul className="list-disc space-y-1 pl-5">
          <li>アカウント情報: メールアドレス、ログインに使う外部サービス(Google)の識別子</li>
          <li>プロフィール情報: 表示名、自己紹介、アバター画像、SNS のリンク等</li>
          <li>
            利用者コンテンツ: 卓のデータ、チャット・ダイスのログ、キャラクターシート、
            アップロードした画像・音声、共有メモ、日程調整の内容
          </li>
          <li>フレンド・招待に関する情報</li>
          <li>決済に関する情報(決済は Stripe が処理し、カード番号は本サービスに保存されません)</li>
          <li>AI 機能に入力した内容</li>
          <li>不具合報告・お問い合わせの内容(送信時の画面の URL、アプリのバージョン等を含みます)</li>
          <li>
            利用状況に関する情報: IP アドレス、ブラウザ・端末の種類、アクセス日時、
            エラー情報
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. 利用目的">
        <ul className="list-disc space-y-1 pl-5">
          <li>本サービスの提供(卓の同期・保存、キャラクターシートの保存等)</li>
          <li>本人確認、アカウントの管理、不正利用の防止・対応</li>
          <li>料金プラン・ゴールドの決済、請求に関する連絡</li>
          <li>お問い合わせ・不具合報告への対応、権利侵害の申告への対応</li>
          <li>重要なお知らせ(規約の変更、サービスの終了等)の連絡</li>
          <li>本サービスの改善・新機能の検討のための分析(個人を特定しない形で行います)</li>
        </ul>
      </LegalSection>

      <LegalSection heading="4. 卓の直結(P2P)と IP アドレス">
        <p>
          卓では、動作を速くするため GM と参加者の端末を直接つなぐ通信(直結)を使います。
          直結では、通信の相手(GM と各参加者)に互いの IP アドレスが伝わります(参加者
          どうしは直結しません)。卓の接続表示から「直結(P2P)を使う」をオフにすると、
          通信はサーバーを経由する中継のみとなり、相手に IP アドレスは伝わりません。
        </p>
      </LegalSection>

      <LegalSection heading="5. 第三者への提供・外国にある第三者">
        <p>
          運営者は、次の場合を除き、あらかじめ本人の同意を得ずに個人データを第三者に
          提供しません。
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>法令に基づく場合</li>
          <li>人の生命・身体・財産の保護のために必要で、本人の同意を得ることが困難な場合</li>
          <li>利用目的の達成に必要な範囲で、取り扱いを委託する場合</li>
          <li>事業の承継に伴って提供する場合</li>
        </ul>
        <p>
          運営者は、本サービスの提供のため、下表「6. 外部送信」の事業者(いずれも米国に
          所在)のサービスを利用しており、個人データの取り扱いの全部または一部がこれらの
          事業者のサーバーで行われます。米国の個人情報保護制度については、個人情報保護委員会が
          公表している「外国における個人情報の保護に関する制度等の調査」をご参照ください。
          これらの事業者は、個人情報の保護に関する国際的な基準(SOC 2、ISO/IEC 27001 等)に
          基づく措置を講じていることを公表しています。
        </p>
      </LegalSection>

      <LegalSection heading="6. 外部送信(電気通信事業法に基づく公表)">
        <p>
          本サービスでは、利用者の端末から次の事業者へ情報が送信されます。
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-1.5 pr-2">送信先</th>
                <th className="py-1.5 pr-2">目的</th>
                <th className="py-1.5 pr-2">送信される情報</th>
                <th className="py-1.5 pr-2">送信されるとき</th>
                <th className="py-1.5">送信先のポリシー</th>
              </tr>
            </thead>
            <tbody>
              {EXTERNAL.map((e) => (
                <tr key={e.to + e.purpose} className="border-b border-border align-top">
                  <td className="py-1.5 pr-2">{e.to}</td>
                  <td className="py-1.5 pr-2">{e.purpose}</td>
                  <td className="py-1.5 pr-2">{e.data}</td>
                  <td className="py-1.5 pr-2">{e.when}</td>
                  <td className="break-all py-1.5">{e.policy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          このほか、AI 機能を使った場合は入力内容が回答の生成のため Anthropic, PBC(米国)へ、
          外部のキャラクターシート保管サービスから取り込む場合は運営者のサーバーから当該
          サービスへ、取り込み対象の URL が送信されます。本サービスに広告を表示する場合は、
          広告配信事業者と送信される情報をこの表に追記してから表示します。
        </p>
      </LegalSection>

      <LegalSection heading="7. Cookie・ローカルストレージ">
        <p>
          本サービスは、ログイン状態の維持のために Cookie を、卓での表示名・音量・直結の
          設定等の保存のためにブラウザのローカルストレージを使用します。ローカルストレージの
          設定は端末内にのみ保存されます。
        </p>
      </LegalSection>

      <LegalSection heading="8. 安全管理措置">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            組織的・人的措置: 個人データを取り扱う者を運営者に限定し、取り扱いに関する
            ルールを定めています。
          </li>
          <li>
            技術的措置: 通信の暗号化(HTTPS / DTLS)、データベースの行単位のアクセス制御、
            管理画面の多要素認証、秘密鍵のサーバー専用化、レート制限による不正アクセスの
            抑止を行っています。
          </li>
          <li>
            外的環境の把握: 個人データを保管する事業者が所在する米国の個人情報保護制度を
            把握したうえで、安全管理措置を講じています。
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="9. 保存期間と削除">
        <p>
          利用者は、アカウント設定ページからいつでも退会(アカウント削除)できます。退会時には、
          プロフィール情報、卓のデータ、キャラクターシート、ライブラリの登録情報を削除します。
          アップロードした画像・音声ファイルは、退会後に順次削除します(直ちに削除を希望する
          場合は下記窓口へご連絡ください)。決済の記録は、法令(税法等)上の保存義務のため、
          必要な期間保管します。
        </p>
      </LegalSection>

      <LegalSection heading="10. 開示・訂正・利用停止等の請求">
        <p>
          保有個人データの利用目的の通知、開示、訂正・追加・削除、利用停止・消去、
          第三者提供の停止、第三者提供記録の開示のご請求は、下記窓口までご連絡ください。
          ご本人(または代理人)であることを確認したうえで、法令に従い遅滞なく対応します。
          手数料はいただきません。
        </p>
      </LegalSection>

      <LegalSection heading="11. 未成年の方">
        <p>
          未成年の方は、親権者等の法定代理人の同意を得たうえで本サービスを利用してください。
        </p>
      </LegalSection>

      <LegalSection heading="12. 改定">
        <p>
          本ポリシーを改定する場合は、改定後の内容と効力発生日を本サービス上でお知らせします。
          利用目的を変更する場合は、法令に従い、変更後の利用目的を公表または通知します。
        </p>
      </LegalSection>

      <LegalSection heading="13. お問い合わせ窓口">
        <ContactInfo purpose="個人情報の取り扱いに関するお問い合わせ・開示等の請求" />
        <p>
          関連:{" "}
          <Link className="underline" href="/terms">
            利用規約
          </Link>
          {" / "}
          <Link className="underline" href={"/legal/guidelines" as Route}>
            コミュニティガイドライン
          </Link>
        </p>
      </LegalSection>
    </LegalLayout>
  );
}

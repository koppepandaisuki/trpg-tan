import Link from "next/link";
import type { Route } from "next";
import { Scale } from "lucide-react";
import { LegalLayout, LegalSection } from "@/components/legal/legal-layout";
import { ContactInfo } from "@/components/legal/contact-info";
import {
  DISCLOSE_ON_REQUEST,
  LEGAL_UPDATED_AT,
  getOperator,
} from "@/lib/legal/operator";

export const metadata = { title: "特定商取引法に基づく表記" };

/**
 * 特定商取引法に基づく表記。
 *
 * 有償で提供するのは料金プラン(月額)とゴールドのみ(2026-09 にストア廃止)。
 * 事業者の氏名・住所・電話番号は env(lib/legal/operator.ts)から表示し、未設定なら
 * 「請求があれば遅滞なく開示」とする(法 11 条ただし書)。ただし Stripe の審査では
 * 表記の実在が確認されることがあるため、本番では設定を推奨(docs/legal/README.md)。
 */
export default function TokushohoPage() {
  const op = getOperator();
  return (
    <LegalLayout
      title="特定商取引法に基づく表記"
      icon={Scale}
      lastUpdated={LEGAL_UPDATED_AT}
    >
      <LegalSection heading="販売事業者">
        <p>{op.name ?? DISCLOSE_ON_REQUEST}</p>
      </LegalSection>

      <LegalSection heading="運営責任者">
        <p>{op.representative ?? DISCLOSE_ON_REQUEST}</p>
      </LegalSection>

      <LegalSection heading="所在地">
        <p>{op.address ?? DISCLOSE_ON_REQUEST}</p>
      </LegalSection>

      <LegalSection heading="電話番号">
        <p>{op.phone ?? DISCLOSE_ON_REQUEST}</p>
        <p className="text-xs">
          お問い合わせは、まず下記のお問い合わせ先へお願いします(電話での対応は行って
          いない場合があります)。
        </p>
      </LegalSection>

      <LegalSection heading="お問い合わせ先">
        <ContactInfo purpose="お問い合わせ・上記事項の開示請求" />
        <p>原則として 5 営業日以内に返信します。</p>
      </LegalSection>

      <LegalSection heading="販売価格">
        <p>
          料金プラン(月額)は
          <Link className="underline" href={"/pricing" as Route}>
            料金プランページ
          </Link>
          に、ゴールドは購入画面に、それぞれ税込価格で表示します。
        </p>
      </LegalSection>

      <LegalSection heading="商品代金以外の必要料金">
        <p>なし(インターネット接続に必要な通信料等は利用者の負担となります)。</p>
      </LegalSection>

      <LegalSection heading="支払方法・支払時期">
        <p>クレジットカード決済(Stripe)。</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            料金プラン: 申込時に初回分を決済し、以降は解約するまで 1 か月ごとの更新日に
            自動で決済されます。
          </li>
          <li>ゴールド: 購入手続きの完了時に決済されます。</li>
        </ul>
      </LegalSection>

      <LegalSection heading="提供時期">
        <p>決済完了後、ただちにご利用いただけます。</p>
      </LegalSection>

      <LegalSection heading="契約期間・解約(自動更新)">
        <p>
          料金プランは 1 か月単位の自動更新契約です。料金プランページの「契約を管理」から
          いつでも解約できます。解約後は次回以降の請求が停止し、支払い済みの期間の終了まで
          有料の機能をご利用いただけます。
        </p>
      </LegalSection>

      <LegalSection heading="返品・キャンセル">
        <p>
          デジタルサービスの性質上、決済完了後の返金は原則としてお受けできません
          (料金プランの日割り返金、購入済みゴールドの払い戻しを含みます)。ただし、
          本サービスの不具合等により相当期間ご利用いただけなかった場合は、返金等の対応を
          行います。
        </p>
      </LegalSection>

      <LegalSection heading="動作環境">
        <p>
          最新版の主要ブラウザ(Chrome / Edge / Safari / Firefox)。デスクトップアプリは
          Windows に対応しています。
        </p>
      </LegalSection>
    </LegalLayout>
  );
}

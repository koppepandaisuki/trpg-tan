import { Scale } from "lucide-react";
import { LegalLayout, LegalSection } from "@/components/legal/legal-layout";

export const metadata = { title: "特定商取引法に基づく表記" };

/**
 * 特定商取引法に基づく表記(暫定版)。
 *
 * 2026-09 のストア(作品売買)廃止後、有償で提供するのは料金プラン(月額)と
 * ゴールドのみ。表記もその 2 つに合わせた。
 *
 * 注意: 実際の事業者情報(氏名・住所・電話番号等)は本番運用前に
 * 正確な内容へ差し替えること。α 期間中はプレースホルダ。
 */
export default function TokushohoPage() {
  return (
    <LegalLayout
      title="特定商取引法に基づく表記"
      icon={Scale}
      lastUpdated="2026-09-24"
    >
      <p>
        「特定商取引に関する法律」第11条に基づき、以下のとおり表記します。
      </p>

      <LegalSection heading="販売事業者">
        <p>Re-dice TRPGサイト 運営者</p>
        <p className="text-xs">
          ※ α テスト期間中のため、正式な事業者情報は本リリース時に掲載します。
          請求があった場合は遅滞なく開示いたします。
        </p>
      </LegalSection>

      <LegalSection heading="運営責任者">
        <p>α テスト期間中につき、Discord にてお問い合わせください。</p>
      </LegalSection>

      <LegalSection heading="お問い合わせ先">
        <p>
          本サービスの Discord コミュニティ。原則として 5 営業日以内に返信します。
        </p>
      </LegalSection>

      <LegalSection heading="販売価格">
        <p>
          料金プラン(月額)は料金プランページに、ゴールドは購入画面に、
          それぞれ税込価格で表示します。
        </p>
      </LegalSection>

      <LegalSection heading="商品代金以外の必要料金">
        <p>なし(インターネット接続に必要な通信料等は利用者の負担となります)。</p>
      </LegalSection>

      <LegalSection heading="支払方法・支払時期">
        <p>クレジットカード決済(Stripe)。</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            料金プラン: 申込時に初回分を決済し、以降は解約するまで毎月の更新日に
            自動で決済されます。
          </li>
          <li>ゴールド: 購入手続きの完了時に決済されます。</li>
        </ul>
      </LegalSection>

      <LegalSection heading="提供時期">
        <p>決済完了後、ただちにご利用いただけます。</p>
      </LegalSection>

      <LegalSection heading="契約期間・解約">
        <p>
          料金プランは 1 か月単位の自動更新契約です。料金プランページの
          「契約を管理」からいつでも解約でき、解約後は次回以降の請求が停止します。
        </p>
      </LegalSection>

      <LegalSection heading="返品・キャンセル">
        <p>
          デジタルサービスの性質上、決済完了後の返金は原則としてお受けできません
          (料金プランの日割り返金、購入済みゴールドの払い戻しを含みます)。
          ただし、サービスの不具合によりご利用いただけない場合は、運営者の判断により
          返金対応を行うことがあります。
        </p>
      </LegalSection>

      <LegalSection heading="動作環境">
        <p>
          最新版の主要ブラウザ(Chrome / Edge / Safari / Firefox)。
          デスクトップアプリは Windows に対応しています。
        </p>
      </LegalSection>
    </LegalLayout>
  );
}

import { Scale } from "lucide-react";
import { LegalLayout, LegalSection } from "@/components/legal/legal-layout";

export const metadata = { title: "特定商取引法に基づく表記" };

/**
 * 特定商取引法に基づく表記(暫定版)。
 *
 * 注意: 実際の事業者情報(氏名・住所・電話番号等)は本番運用前に
 * 正確な内容へ差し替えること。α 期間中はプレースホルダ。
 */
export default function TokushohoPage() {
  return (
    <LegalLayout
      title="特定商取引法に基づく表記"
      icon={Scale}
      lastUpdated="2026-06-05"
    >
      <p>
        「特定商取引に関する法律」第11条に基づき、以下のとおり表記します。
      </p>

      <LegalSection heading="販売事業者">
        <p>パラDa-iCE TRPGサイト 運営者</p>
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
          各作品ページに税込価格で表示します。表示価格のほかに必要となる料金は
          ありません(通信料等は利用者の負担となります)。
        </p>
      </LegalSection>

      <LegalSection heading="商品代金以外の必要料金">
        <p>なし(ダウンロード販売のため送料はかかりません)。</p>
      </LegalSection>

      <LegalSection heading="支払方法・支払時期">
        <p>
          クレジットカード決済(Stripe)。購入手続き完了時に決済が行われます。
        </p>
      </LegalSection>

      <LegalSection heading="商品の引渡し時期">
        <p>
          決済完了後、ただちにライブラリからダウンロード可能となります。
        </p>
      </LegalSection>

      <LegalSection heading="返品・キャンセル">
        <p>
          デジタル作品の性質上、購入後の返品・キャンセルは原則としてお受けできません。
          ただし、作品が説明と著しく異なる場合やダウンロードできない不具合がある
          場合は、運営者の判断により返金対応を行うことがあります。
        </p>
      </LegalSection>

      <LegalSection heading="動作環境">
        <p>
          作品の閲覧・利用には、各作品ページに記載のファイル形式
          (PDF / 画像 / 音声等)に対応した環境が必要です。
        </p>
      </LegalSection>
    </LegalLayout>
  );
}

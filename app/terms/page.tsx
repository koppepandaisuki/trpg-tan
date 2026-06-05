import { FileText } from "lucide-react";
import { LegalLayout, LegalSection } from "@/components/legal/legal-layout";

export const metadata = { title: "利用規約" };

/**
 * 利用規約(暫定版)。α 期間中の最小限の規約。Phase 2 で弁護士レビューを
 * 経た正式版に差し替える。
 */
export default function TermsPage() {
  return (
    <LegalLayout title="利用規約" icon={FileText} lastUpdated="2026-06-05">
      <p>
        本利用規約(以下「本規約」)は、パラDa-iCE TRPGサイト(以下「本サービス」)の
        利用条件を定めるものです。利用者は本規約に同意のうえ本サービスを利用するものとします。
      </p>

      <LegalSection heading="第1条(適用)">
        <p>
          本規約は、本サービスの提供条件および本サービスの利用に関する運営者と
          利用者との間の権利義務関係を定めることを目的とし、利用者と運営者との間の
          本サービスの利用に関わる一切の関係に適用されます。
        </p>
      </LegalSection>

      <LegalSection heading="第2条(アカウント登録)">
        <p>
          利用者は、本サービスの定める方法によりアカウント登録を行うものとします。
          登録情報は正確かつ最新の内容を保つものとし、虚偽の情報を登録してはなりません。
          アカウントの管理責任は利用者が負うものとします。
        </p>
      </LegalSection>

      <LegalSection heading="第3条(作品の投稿・販売)">
        <p>
          クリエイターは、自身が正当な権利を有する作品のみを投稿・販売できます。
          第三者の著作権、商標権その他の権利を侵害する作品の投稿を禁止します。
          販売代金から所定のプラットフォーム手数料(30%)を差し引いた金額が
          クリエイターに支払われます。
        </p>
      </LegalSection>

      <LegalSection heading="第4条(禁止事項)">
        <p>利用者は、以下の行為をしてはなりません。</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>法令または公序良俗に違反する行為</li>
          <li>第三者の権利を侵害する作品の投稿・販売</li>
          <li>本サービスの運営を妨害する行為</li>
          <li>他の利用者に対する迷惑行為・誹謗中傷</li>
          <li>不正アクセス、その他システムに不正に干渉する行為</li>
        </ul>
      </LegalSection>

      <LegalSection heading="第5条(購入・返金)">
        <p>
          購入したデジタル作品は、原則として返金できません。ただし、作品が
          説明と著しく異なる場合や、ダウンロードできない不具合がある場合は、
          運営者の判断により返金対応を行うことがあります。
        </p>
      </LegalSection>

      <LegalSection heading="第6条(免責事項)">
        <p>
          本サービスは現状有姿で提供され、運営者は本サービスの完全性・正確性・
          有用性等についていかなる保証も行いません。α テスト期間中は仕様変更や
          データのリセットが行われる場合があります。
        </p>
      </LegalSection>

      <LegalSection heading="第7条(規約の変更)">
        <p>
          運営者は、必要と判断した場合、利用者に通知することなく本規約を変更できる
          ものとします。変更後の本規約は、本サービス上に表示した時点から効力を
          生じるものとします。
        </p>
      </LegalSection>

      <LegalSection heading="第8条(お問い合わせ)">
        <p>
          本規約に関するお問い合わせは、本サービスの Discord コミュニティを通じて
          受け付けています。
        </p>
      </LegalSection>
    </LegalLayout>
  );
}

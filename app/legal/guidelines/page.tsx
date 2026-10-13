import Link from "next/link";
import type { Route } from "next";
import { Users } from "lucide-react";
import { LegalLayout, LegalSection } from "@/components/legal/legal-layout";
import { ContactInfo } from "@/components/legal/contact-info";
import { LEGAL_UPDATED_AT, SERVICE_NAME } from "@/lib/legal/operator";

export const metadata = { title: "コミュニティガイドライン" };

/**
 * コミュニティガイドライン(卓のマナー・素材と二次創作・配信・通報)。
 * 利用規約 第 2 条で規約の一部として扱う。
 */
export default function GuidelinesPage() {
  return (
    <LegalLayout
      title="コミュニティガイドライン"
      icon={Users}
      lastUpdated={LEGAL_UPDATED_AT}
    >
      <p>
        {SERVICE_NAME}は、TRPG を遊ぶすべての人が安心して卓を囲めることを大切にしています。
        このガイドラインは
        <Link className="underline" href="/terms">
          利用規約
        </Link>
        の一部です。
      </p>

      <LegalSection heading="1. 卓のマナー">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            ホラー・流血・恋愛などの表現を含むシナリオは、事前に参加者へ内容の傾向
            (注意事項・地雷になりうる要素)を伝え、全員の同意を得てから遊びましょう。
          </li>
          <li>
            参加者が「やめてほしい」と伝えた表現は、ゲーム中でも避けてください。
          </li>
          <li>
            公開募集の卓では、初対面の相手への配慮を。個人情報(本名・住所・学校・勤務先等)を
            聞き出したり、公開したりしないでください。
          </li>
          <li>
            卓を抜けたい・休みたいと言われたら尊重してください。
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="2. 禁止しているコンテンツ・行為">
        <ul className="list-disc space-y-1 pl-5">
          <li>実在の人物・団体への誹謗中傷、差別、脅迫、嫌がらせ</li>
          <li>児童を性的に描写するコンテンツ(架空のキャラクターを含みます)</li>
          <li>参加者の同意のない性的・残虐な画像の共有</li>
          <li>他人の著作物(イラスト、楽曲、ルールブックの本文、有料シナリオ等)の無断アップロード</li>
          <li>他人へのなりすまし、運営者・公式を名乗る行為</li>
          <li>違法行為の勧誘・助長、スパム、宣伝目的の卓</li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. 素材(画像・音声)を使うとき">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            自作の素材、または利用規約で利用が認められているフリー素材・購入素材を使って
            ください。フリー素材でも「クレジット表記が必要」「加工禁止」「配信での利用は別料金」
            などの条件があるので、素材サイトの規約を確認しましょう。
          </li>
          <li>
            他人のイラストを立ち絵・背景に使うときは、作者の許可を得てください。
          </li>
          <li>
            アップロードした素材は、卓の参加者へ配信するため推測困難な URL で公開されます。
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="4. TRPG システム・シナリオと二次創作">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            各システムの権利者(出版社等)やシナリオ作者が定めるガイドライン・利用条件に
            従ってください(配信・リプレイ公開・同人頒布の可否、権利表記の書き方など)。
          </li>
          <li>
            ルールブックやシナリオの本文を、共有メモ等に転載して共有しないでください。
          </li>
          <li>
            {SERVICE_NAME}のキャラクターシート・ダイス機能は、各システムの公式のものでは
            ありません(
            <Link className="underline" href={"/legal/rights" as Route}>
              権利表記
            </Link>
            )。
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="5. 配信・動画・スクリーンショット">
        <p>
          {SERVICE_NAME}の画面を、配信・動画・スクリーンショット・リプレイに使うことは自由です
          (営利・非営利を問いません。クレジット表記は任意ですが、書いていただけると
          うれしいです)。画面に映る素材・シナリオ・キャラクターの権利は、それぞれの権利者の
          条件に従ってください。他の参加者の名前や発言を公開する場合は、本人の了承を得ましょう。
        </p>
      </LegalSection>

      <LegalSection heading="6. 通報と削除申出">
        <p>
          ガイドライン違反や権利侵害を見つけたときは、サイト右下の報告ボタンから種類
          「権利侵害・違反の申告」を選んで、対象(卓の参加コード・URL・画面の説明等)と
          内容を送ってください。権利者ご本人からの削除申出も同じ窓口で受け付けます。
        </p>
        <ContactInfo purpose="権利侵害・違反の申告" />
        <p>
          運営者は内容を確認し、必要に応じてコンテンツの削除、アカウントの利用停止等の
          措置を行います。緊急性の高いもの(児童の安全、生命・身体への危険)は優先して
          対応します。
        </p>
      </LegalSection>
    </LegalLayout>
  );
}

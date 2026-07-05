import type { Route } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { LegalLayout, LegalSection } from "@/components/legal/legal-layout";

export const metadata = {
  title: "出品ガイドライン",
  description:
    "Re-dice に作品を出品する際のルール。出品できる作品・できない作品、審査の流れ、公開後の対応について。",
};

/**
 * 出品ガイドライン。
 *
 * 審査(モデレーション)の判断基準を公開し、却下の納得感を高めるためのページ。
 * 内容は AI 事前審査のポリシー(lib/moderation/ai-screen.ts)・通報カテゴリ
 * (lib/validators/report.ts)・審査パイプライン(0024)と整合させている。
 */
export default function GuidelinesPage() {
  return (
    <LegalLayout title="出品ガイドライン" icon={ShieldCheck} lastUpdated="2026-06-17">
      <p>
        本ガイドラインは、Re-dice(以下「本サービス」)に作品を出品する際のルールを
        定めるものです。
        <Link href={"/terms" as Route} className="text-accent underline">
          利用規約
        </Link>
        の一部を構成し、出品されたすべての作品に適用されます。気持ちよく遊べる
        TRPG 素材のマーケットを保つため、出品前に必ずご確認ください。
      </p>

      <LegalSection heading="1. 出品できる作品">
        <p>
          本サービスは TRPG(テーブルトークRPG)で遊ぶための素材を扱うマーケットです。
          次のような、TRPG 遊びに資する作品を出品できます。
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>シナリオ / シナリオ集</li>
          <li>オリジナルシステム・ルールブック・サプリメント</li>
          <li>キャラクターシート / プリジェネ(事前作成キャラ)</li>
          <li>マップ・背景・立ち絵・アイコンなどのイラスト素材</li>
          <li>BGM・環境音・効果音(SE)</li>
          <li>GM(ゲームマスター)支援ツール、フルパッケージ(.paradice)</li>
        </ul>
      </LegalSection>

      <LegalSection heading="2. 出品できない作品(禁止)">
        <p>
          次に該当する作品は出品できません。審査で却下され、公開後に判明した場合は
          公開停止・削除の対象となります。
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>TRPG 素材ではないもの</strong> —
            本サービスの趣旨と無関係な商品、TRPG と関係のない宣伝・告知のみのもの。
          </li>
          <li>
            <strong>権利を侵害するもの</strong> —
            第三者の著作権・商標権・肖像権その他の権利を侵害する作品、
            無断転載・海賊版・正規の許諾を得ていない二次配布。
          </li>
          <li>
            <strong>違法・規約違反</strong> —
            法令または公序良俗に反する内容、犯罪を助長する内容。
          </li>
          <li>
            <strong>不適切・有害な表現</strong> —
            過度に暴力的・残虐な表現、特定の個人・集団への差別や誹謗中傷、
            ヘイトを助長する内容。
          </li>
          <li>
            <strong>未成年者に対する性的表現</strong> — いかなる形式でも固く禁止します。
          </li>
          <li>
            <strong>露骨な性的・アダルト表現</strong> —
            α 期間中は出品をお控えください(年齢区分の仕組みは今後整備予定です)。
          </li>
          <li>
            <strong>スパム・誤認を招く出品</strong> —
            宣伝目的のみの大量出品、内容と著しく異なる説明・サムネイル、
            購入者を欺く表示。
          </li>
        </ul>
        <p className="text-xs">
          判断に迷うものは、利用者からの
          <Link href={"/help" as Route} className="text-accent underline">
            お問い合わせ
          </Link>
          や Discord でご相談ください。
        </p>
      </LegalSection>

      <LegalSection heading="3. 権利とライセンス">
        <p>
          出品できるのは、ご自身が正当な権利を持つ作品に限ります。二次創作を出品する
          場合は、原作の権利者が定めるガイドライン(二次創作の可否・商用利用の可否など)を
          必ず遵守してください。素材(フォント・画像・音源等)を利用する場合も、その
          ライセンス条件の範囲内で出品してください。
        </p>
      </LegalSection>

      <LegalSection heading="4. 審査の流れ">
        <p>
          作品は「下書き → 審査に提出 → 公開」の流れで掲載されます。提出された作品は
          運営が内容を確認し、本ガイドラインに適合していれば公開されます。
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            提出された作品は<strong>審査中</strong>となり、承認されるまでストアには
            表示されません。
          </li>
          <li>
            却下された場合は<strong>理由を添えて</strong>下書きに戻ります。内容を
            修正して再度提出できます。
          </li>
          <li>
            審査の補助として内容の自動チェックを行うことがありますが、最終的な
            判断は運営が行います。
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="5. 公開後の対応">
        <p>
          公開後の作品も、利用者からの通報や運営の確認により、本ガイドライン違反が
          判明した場合は<strong>公開停止</strong>または削除を行います。停止の際は、
          原則として理由をクリエイターに通知します。
        </p>
        <p>
          悪質な違反、繰り返しの違反、虚偽の通報などに対しては、出品の制限や
          アカウントの利用停止などの措置を取ることがあります。
        </p>
      </LegalSection>

      <LegalSection heading="6. 通報について">
        <p>
          掲載中の作品にガイドライン違反を見つけた場合は、各作品ページの
          「この作品を通報する」から運営へ報告できます。通報内容は運営のみが確認し、
          報告者の情報がクリエイターに伝わることはありません。
        </p>
      </LegalSection>

      <LegalSection heading="7. お問い合わせ">
        <p>
          本ガイドラインに関するご質問は、本サービスの Discord コミュニティ、または
          <Link href={"/help" as Route} className="text-accent underline">
            ヘルプ
          </Link>
          を通じて受け付けています。
        </p>
      </LegalSection>
    </LegalLayout>
  );
}

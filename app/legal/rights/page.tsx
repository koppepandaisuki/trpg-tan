import Link from "next/link";
import type { Route } from "next";
import { Copyright } from "lucide-react";
import { LegalLayout, LegalSection } from "@/components/legal/legal-layout";
import { LEGAL_UPDATED_AT, SERVICE_NAME } from "@/lib/legal/operator";

export const metadata = { title: "権利表記・対応システム" };

/**
 * 権利表記・対応システム。
 *
 * 方針(docs/legal/README.md §3):
 *   - 本サービスは各権利者と無関係の非公式ツール。収録はゲームの仕組み
 *     (能力値・技能の名称、数値、計算式)のみで、ルールブック本文・イラストは収録しない。
 *   - 権利者が表記を指定しているもの(CoC)は指定どおりに、SRD 5.1(CC BY 4.0)は
 *     ライセンスの帰属表示を載せる。
 *   - システムを追加したら、その権利者のガイドラインを確認してこの一覧に足すこと。
 */

const SYSTEMS = [
  "クトゥルフ神話TRPG(6版)/ 新クトゥルフ神話TRPG(7版)",
  "ソード・ワールド2.5",
  "ダブルクロス The 3rd Edition",
  "シノビガミ",
  "インセイン",
  "マギカロギア",
  "永い後日談のネクロニカ",
  "パラノイア",
  "トーキョーN◎VA",
  "ゆうやけこやけ",
  "アリアンロッド2E",
  "ログ・ホライズンTRPG",
  "エモクロアTRPG",
];

export default function RightsPage() {
  return (
    <LegalLayout
      title="権利表記・対応システム"
      icon={Copyright}
      lastUpdated={LEGAL_UPDATED_AT}
    >
      <LegalSection heading="非公式ツールであること">
        <p>
          {SERVICE_NAME}は、下記の TRPG システムの権利者とは関係のない、非公式のツールです。
          各システムの名称は、それぞれの権利者の商標または登録商標です。本サービスは、
          各システムで遊ぶための補助機能(キャラクターシートの入力欄、ダイスの判定等)を
          提供するもので、各権利者による公認・推奨を受けたものではありません。
        </p>
      </LegalSection>

      <LegalSection heading="収録しているもの・していないもの">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            収録しているもの: 能力値・技能の名称、数値の範囲、計算式、判定の手順など、
            ゲームを遊ぶための仕組み。職業等の説明文は本サービスが独自に作成したものです。
          </li>
          <li>
            収録していないもの: ルールブックの本文、イラスト、図表、シナリオ。ルールの詳細は、
            各システムの公式のルールブック等をご確認ください。
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="キャラクターシート・ダイスに対応しているシステム">
        <ul className="list-disc space-y-1 pl-5">
          {SYSTEMS.map((s) => (
            <li key={s}>{s}</li>
          ))}
          <li>5th Edition SRD 互換(下記「SRD 5.1」)</li>
        </ul>
      </LegalSection>

      <LegalSection heading="『クトゥルフ神話TRPG』シリーズ">
        <p>
          本サービスのクトゥルフ神話TRPG 関連の機能は、「株式会社アークライト」及び
          「株式会社KADOKAWA」が権利を有する『クトゥルフ神話TRPG』シリーズの二次創作物です。
        </p>
        <p>
          Call of Cthulhu is copyright ©1981, 2015, 2019 by Chaosium Inc. ;all rights
          reserved. Arranged by Arclight Inc.
          <br />
          Call of Cthulhu is a registered trademark of Chaosium Inc.
          <br />
          PUBLISHED BY KADOKAWA CORPORATION
        </p>
      </LegalSection>

      <LegalSection heading="SRD 5.1(Creative Commons Attribution 4.0)">
        <p>
          This work includes material taken from the System Reference Document 5.1
          (&quot;SRD 5.1&quot;) by Wizards of the Coast LLC and available at
          https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is
          licensed under the Creative Commons Attribution 4.0 International License
          available at https://creativecommons.org/licenses/by/4.0/legalcode.
        </p>
      </LegalSection>

      <LegalSection heading="他のサービスとの互換機能">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            「コマ貼付」は、オンラインセッションツール「ココフォリア」(第三者が運営する
            サービス)の駒の書き出し形式を読み込む互換機能です。同サービスの運営者とは
            関係ありません。
          </li>
          <li>
            「キャラクター保管所」からの取り込みは、利用者の操作により、公開されている
            キャラクターシートの情報を取得する機能です。同サイトの運営者とは関係ありません。
          </li>
          <li>
            「TRPGシナリオ工房」は、本サービスの運営者が提供する姉妹アプリです。
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="利用者の皆さまへ">
        <p>
          各システム・シナリオを用いて遊ぶ、配信する、リプレイ等の二次創作物を公開する
          場合は、それぞれの権利者・シナリオ作者が定めるガイドラインに従ってください。
          {SERVICE_NAME}の画面を配信・動画・スクリーンショットに使うことは自由です
          (クレジット表記は任意です)。詳しくは
          <Link className="underline" href={"/legal/guidelines" as Route}>
            コミュニティガイドライン
          </Link>
          をご覧ください。
        </p>
        <p>
          本サービスで利用しているオープンソースソフトウェアのライセンスは
          <Link className="underline" href={"/legal/licenses" as Route}>
            こちら
          </Link>
          。
        </p>
      </LegalSection>
    </LegalLayout>
  );
}

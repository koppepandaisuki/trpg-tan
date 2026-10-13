import { TopHeader } from "@/components/layout/top-header";
import { CharactersViewClient } from "@/components/sheet/characters-view-client";
import { getCurrentUser } from "@/lib/session/get-user";
import { listMyCharacterSheets } from "@/lib/queries/character-sheets";
// キャラシのエディタ(@trpg/ui)はデスクトップと共通。
// 順番が大事: 土台(デスクトップと同じ描画環境を .rd-sheet に作る)を先に、
// 部品固有のスタイルを後に読む。デスクトップでも基本規則 → 部品の順なので、
// 同じ詳細度の衝突(例: [type=button] と .occ-card)を部品側が勝つようにする。
import "@/components/sheet/rd-sheet-base.css";
import "@trpg/ui/sheet.css";

export const metadata = {
  title: "キャラシ",
  description:
    "クトゥルフ神話TRPG(6版/7版)ほか 13 システムのキャラクターシートをブラウザで作成。能力値からチャットパレットまで、デスクトップアプリと同じエディタです。",
};

/**
 * キャラシ(Web 版)。エディタはデスクトップと同じ @trpg/ui のコンポーネント。
 *
 * ログインなしでも作成・編集はできる(試してから登録できるように)。保存は
 * クラウド(character_sheets / 0050)で、ログインが必要。保存数はプランで上限あり。
 */
export default async function CharactersPage() {
  const user = await getCurrentUser();
  const data = user
    ? await listMyCharacterSheets(user.id)
    : { ok: true, sheets: [], quota: null };

  return (
    <>
      <TopHeader />
      <CharactersViewClient
        loggedIn={!!user}
        initialSheets={data.sheets}
        initialQuota={data.quota}
        storageReady={data.ok}
      />
    </>
  );
}

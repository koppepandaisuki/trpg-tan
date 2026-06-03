import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { HomeHero } from "@/components/store/home-hero";
import { ProductStrip } from "@/components/store/product-strip";
import { CategoryGrid } from "@/components/store/category-grid";
import { RecentlyViewed } from "@/components/recent/recently-viewed";
import { TopCreatorsSection } from "@/components/creator/top-creators-section";
import {
  listRecentProducts,
  listTopSellingProducts,
} from "@/lib/queries/products";
import { getTopCreators } from "@/lib/queries/top-creators";

/**
 * トップページ = ストアのランディング。Steam の Store front page を参考に、
 * 上から:
 *   1. Hero(サイトの概要 + 主導線)
 *   2. 売上上位 strip(購入数の多い順、無ければ新着に fallback)
 *   3. 新着 strip(published_at desc)
 *   4. カテゴリ grid(クリックで /store?category=xxx)
 *
 * α 期間中は実商品が少ないため、strip は空のときは描画しない
 * (ProductStrip 側で 0 件チェック)。Hero は常に出る。
 */

// root layout の title.default に任せて、ホームでは独自 title を出さない
// (「パラDa-iCE TRPGサイト」がブラウザタブに出る)。

// 1 分で revalidate(ストアのフロントなので頻繁更新は不要)
export const revalidate = 60;

export default async function HomePage() {
  // 売上上位 / 新着 / 人気クリエイター TOP 3 を並行 fetch
  const [topSellers, recent, topCreators] = await Promise.all([
    listTopSellingProducts(12),
    listRecentProducts(12),
    getTopCreators(3),
  ]);

  // 「売上上位」が新着に fallback している場合、両者が重複する。
  // 重複表示を避けるため、新着は売上上位に含まれない ID のみに絞る。
  const topSellerIds = new Set(topSellers.map((p) => p.id));
  const filteredRecent = recent.filter((p) => !topSellerIds.has(p.id));

  const hasProducts = topSellers.length > 0 || recent.length > 0;

  // listTopSellingProducts は購入ゼロのとき listRecentProducts に
  // fallback する設計。両者の長さが同じで重複が完全 = まだ実購入が無い
  // ことの目印になる。テスター向けに表示文言を分岐させる。
  const noRealSalesYet =
    topSellers.length > 0 &&
    topSellers.length === recent.length &&
    topSellers.every((p, i) => p.id === recent[i].id);

  return (
    <>
      <TopHeader />
      <PageContainer className="space-y-10 py-8">
        <HomeHero hasProducts={hasProducts} />

        {/* 「最近見た作品」は localStorage 由来の client section。
            履歴がない訪問者には何も描画されない設計なので、上位に置いても
            ノイズにならない(2 回目訪問以降の常連 UX に効く)。 */}
        <RecentlyViewed />

        <ProductStrip
          title="売上上位"
          description={
            noRealSalesYet
              ? "実購入データが集まり次第、売上順に並び替わります(現状は新着順で表示)"
              : "購入数が多い順"
          }
          products={topSellers}
          seeAllHref="/store"
        />

        {filteredRecent.length > 0 && (
          <ProductStrip
            title="新着"
            description="最近公開された作品"
            products={filteredRecent}
            seeAllHref="/store"
          />
        )}

        {/* 人気クリエイター TOP 3。実購入がないうちはセクションごと
            非表示(α 初期はゼロ)。4 位以下は /creators から。 */}
        <TopCreatorsSection entries={topCreators} />

        <CategoryGrid />
      </PageContainer>
    </>
  );
}

import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { HomeHero } from "@/components/store/home-hero";
import { ProductStrip } from "@/components/store/product-strip";
import { CategoryGrid } from "@/components/store/category-grid";
import { HomeCarousel } from "@/components/store/home-carousel";
import { RecentlyViewed } from "@/components/recent/recently-viewed";
import { FavoritesSection } from "@/components/favorites/favorites-section";
import { FollowingCreatorsSection } from "@/components/creator/following-creators-section";
import { TopCreatorsSection } from "@/components/creator/top-creators-section";
import { CreatorEntryCard } from "@/components/creator/creator-entry-card";
import { CreatorApplyCta } from "@/components/store/creator-apply-cta";
import { getCurrentUser } from "@/lib/session/get-user";
import {
  listRecentProducts,
  listTopSellingProducts,
  listTopRatedProducts,
  listFeaturedProducts,
  listProductsByCategory,
} from "@/lib/queries/products";
import { getTopCreators } from "@/lib/queries/top-creators";
import { publicCoverUrl, publicAvatarUrl } from "@/lib/format/storage";
import { STORE_CATEGORIES, categoryLabel } from "@/lib/format/category";
import type { ProductType } from "@/lib/queries/types";

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

// ジャンル別おすすめ用のカテゴリ一覧(STORE_CATEGORIES から「すべて」を除外)。
// 表示順は STORE_CATEGORIES の並びを尊重(シナリオ → ルールブック → マップ
// → アートワーク → BGM)。
const RECOMMENDATION_CATEGORIES: ProductType[] = STORE_CATEGORIES.filter(
  (c): c is { value: ProductType; label: string } => c.value !== null,
).map((c) => c.value);

export default async function HomePage() {
  // ログイン状態 + クリエイター/管理者かどうか(申請カードの出し分けに使う)。
  const currentUser = await getCurrentUser();
  const showCreatorApply =
    !currentUser || (!currentUser.isCreator && !currentUser.isAdmin);

  // 売上上位 / 新着 / 好評 / 人気クリエイター / フィーチャー /
  // 各カテゴリの上位作品 をすべて並行 fetch
  const [
    topSellers,
    recent,
    topRated,
    topCreators,
    featured,
    ...categoryRecommendations
  ] = await Promise.all([
    listTopSellingProducts(12),
    listRecentProducts(12),
    listTopRatedProducts(12),
    getTopCreators(3),
    listFeaturedProducts(8),
    ...RECOMMENDATION_CATEGORIES.map((cat) => listProductsByCategory(cat, 6)),
  ]);

  // Carousel に渡す軽量 item に変換(server で URL 解決 → client 安全)
  const carouselItems = featured.map((p) => ({
    slug: p.slug,
    title: p.title,
    coverUrl: publicCoverUrl(p.coverPath),
    productType: p.productType,
    priceJpy: p.priceJpy,
    reviewSummary: p.reviewSummary ?? null,
    creator: {
      id: p.creator.id,
      displayName: p.creator.displayName,
      avatarUrl: publicAvatarUrl(p.creator.avatarPath),
    },
  }));

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

        {/* Steam ライク大型カルーセル(TTTT): 売上上位 + 好評 + 新着 を
            組合せた注目作品を auto-rotate。実商品が 1 件もないときは
            描画ゼロ(α 初期は HomeHero だけが見える)。 */}
        <HomeCarousel items={carouselItems} />

        {/* お気に入りは localStorage 由来。0 件のときは描画ゼロ。
            最近見たの上に置いて、常連の「自分の棚」感を強化。 */}
        <FavoritesSection />

        {/* フォロー中のクリエイター。DB(creator_follows)由来。ISR を保つため
            クライアントで server action 取得。0 件 / 未ログインは描画ゼロ。 */}
        <FollowingCreatorsSection />

        {/* 「最近見た作品」は localStorage 由来の client section。
            履歴がない訪問者には何も描画されない設計なので、上位に置いても
            ノイズにならない(2 回目訪問以降の常連 UX に効く)。 */}
        <RecentlyViewed />

        <ProductStrip
          title="人気ランキング"
          description={
            noRealSalesYet
              ? "実購入データが集まり次第、売上順に並び替わります(現状は新着順で表示)"
              : "購入数が多い順"
          }
          products={topSellers}
          seeAllHref="/store"
          ranked
        />

        {/* 好評な作品 strip(MMMM): listTopRatedProducts が「評価ありが
            1 件以上」のときだけ items を返すので、0 件のときは strip ごと
            消える。「すべて見る」は /store?sort=rating に飛ばす。 */}
        {topRated.length > 0 && (
          <ProductStrip
            title="好評な作品"
            description="購入者の評価が高い順"
            products={topRated}
            seeAllHref="/store?sort=rating"
          />
        )}

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

        {/* ジャンル別おすすめ(AAAAA): 各カテゴリ 6 件ずつ。0 件カテゴリは
            セクションごと非表示。表示順は STORE_CATEGORIES の並びを尊重。 */}
        {RECOMMENDATION_CATEGORIES.map((cat, i) => {
          const items = categoryRecommendations[i];
          if (items.length === 0) return null;
          return (
            <ProductStrip
              key={cat}
              title={`${categoryLabel(cat)} のおすすめ`}
              description="このジャンルで注目の作品(好評順)"
              products={items}
              seeAllHref={`/store?category=${cat}`}
            />
          );
        })}

        <CategoryGrid />

        {/* 「クリエイターを探す」入口カード(EEEE)。CategoryGrid と並ぶ
            「人軸」の発見入口。 */}
        <CreatorEntryCard />

        {/* 自分が出品側に回るための「クリエイター申請」カード。既に
            creator/admin の人には出さない。 */}
        {showCreatorApply && (
          <CreatorApplyCta isLoggedIn={!!currentUser} />
        )}
      </PageContainer>
    </>
  );
}

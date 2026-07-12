import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import {
  Settings,
  Users,
  Clock,
  Sparkles,
  FileType,
  Briefcase,
  Repeat,
  Calendar,
  Check,
  X,
  Store as StoreIcon,
  ShoppingBag,
  ThumbsUp,
  ThumbsDown,
  type LucideIcon,
} from "lucide-react";
import { TopHeader } from "@/components/layout/top-header";
import { ThreeColumn } from "@/components/layout/three-column";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CoverImage } from "@/components/store/cover-image";
import { MediaGallery, type MediaItem } from "@/components/store/media-gallery";
import { listProductScreenshots } from "@/lib/queries/screenshots";
import { publicScreenshotUrl } from "@/lib/format/storage";
import { BuyButton } from "@/components/store/buy-button";
import { ProductStrip } from "@/components/store/product-strip";
import { ProductDetailRecorder } from "@/components/recent/product-detail-recorder";
import { RecentlyViewed } from "@/components/recent/recently-viewed";
import { ReviewSection } from "@/components/review/review-section";
import { ReviewBadge } from "@/components/review/review-badge";
import { ReportButton } from "@/components/store/report-button";
import { FavoriteButton } from "@/components/favorites/favorite-button";
import { getReviewSummary, type ReviewSummary } from "@/lib/queries/reviews";
import { getProductSalesCount } from "@/lib/queries/sales";

/** MetaTable に渡す reviewSummary の最小形(getReviewSummary の戻り型を再利用)*/
type ReviewSummaryShape = ReviewSummary;
import {
  getPublishedProductBySlug,
  listRelatedProducts,
  listProductsByCreator,
} from "@/lib/queries/products";
import { categoryLabel, fileFormatLabel } from "@/lib/format/category";
import {
  isFree,
  formatPrice,
  salePriceJpy,
  effectiveDiscountPercent,
} from "@/lib/format/price";
import { PriceTag } from "@/components/store/price-tag";
import { publicAvatarUrl, publicCoverUrl } from "@/lib/format/storage";
import { getCurrentUser } from "@/lib/session/get-user";
import { isAlreadyPurchased } from "@/lib/access/purchase-access";
import type { ProductDetail } from "@/lib/queries/types";
import { cn } from "@/lib/utils";

interface PageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: PageProps) {
  const product = await getPublishedProductBySlug(params.slug);
  if (!product) return { title: "作品が見つかりません" };
  // title は string → root の title.template が「| Re-dice」を自動付与
  return {
    title: product.title,
    description: product.description.slice(0, 120),
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const product = await getPublishedProductBySlug(params.slug);
  if (!product) notFound();

  const coverUrl = publicCoverUrl(product.coverPath);
  const avatarUrl = publicAvatarUrl(product.creator.avatarPath);

  // CTA state — decided on the server so we never render a "buy" button to
  // someone who already owns the product. 無料も purchases に行が入るので
  // isAlreadyPurchased は無料を含めて全件チェックする。
  const user = await getCurrentUser();
  const isOwnProduct = !!user && product.creator.id === user.id;
  const purchased =
    !!user && !isOwnProduct
      ? await isAlreadyPurchased(user.id, product.id)
      : false;

  // CTA の無料判定は「今」の実効価格(割引・期間込み)で行う。割引100%(期間内)は
  // 「無料で入手」になり、決済側(checkout)の無料フローとも一致する。
  const effectivePriceJpy = salePriceJpy(
    product.priceJpy,
    effectiveDiscountPercent(
      product.discountPercent,
      product.discountStartsAt,
      product.discountEndsAt,
    ),
  );
  const ctaState: CtaState = isOwnProduct
    ? "own"
    : purchased
      ? "purchased"
      : !user
        ? "login"
        : isFree(effectivePriceJpy)
          ? "free"
          : "buy";

  // 関連作品 / クリエイター他作品 / 評価サマリ / 販売数 / スクショ を並行 fetch
  const [
    related,
    otherByCreator,
    heroReviewSummary,
    salesCount,
    screenshots,
  ] = await Promise.all([
    listRelatedProducts({
      productType: product.productType,
      excludeId: product.id,
      limit: 6,
    }),
    listProductsByCreator({
      creatorId: product.creator.id,
      excludeId: product.id,
      limit: 6,
    }),
    getReviewSummary(product.id),
    getProductSalesCount(product.id),
    listProductScreenshots(product.id),
  ]);

  // MediaGallery 用に「カバー → スクショ」の配列を組み立てる(EEEEE)。
  // カバーが無い商品はスクショだけ、両方無いと空配列(placeholder 表示)。
  const galleryItems: MediaItem[] = [];
  if (coverUrl) {
    galleryItems.push({ src: coverUrl, alt: product.title });
  }
  for (let i = 0; i < screenshots.length; i++) {
    const url = publicScreenshotUrl(screenshots[i].path);
    if (url) {
      galleryItems.push({
        src: url,
        alt: `${product.title} スクリーンショット ${i + 1}`,
      });
    }
  }

  // hero に渡す軽量サマリ(ProductReviewSummary 形)
  const heroSummary =
    heroReviewSummary.total > 0
      ? {
          total: heroReviewSummary.total,
          positive: heroReviewSummary.positive,
          avgStars: heroReviewSummary.avgStars ?? 0,
          label: heroReviewSummary.label,
        }
      : null;

  const creatorDisplayName = product.creator.displayName || "このクリエイター";

  return (
    <>
      <TopHeader />
      {/* 「最近見た作品」localStorage に本商品を記録(レンダリングなし)。
          coverUrl は Server 側で publicCoverUrl 解決済を渡して、Client に
          server-only 依存が漏れないようにする。 */}
      <ProductDetailRecorder
        item={{
          slug: product.slug,
          title: product.title,
          coverUrl: publicCoverUrl(product.coverPath),
          productType: product.productType,
          priceJpy: product.priceJpy,
          systemLabel: product.systemLabel,
          creator: {
            id: product.creator.id,
            displayName: product.creator.displayName,
          },
        }}
      />
      <ThreeColumn
        right={
          <PurchasePanel
            product={product}
            avatarUrl={avatarUrl}
            ctaState={ctaState}
          />
        }
      >
        <Breadcrumb
          items={[
            { href: "/store", label: "ストア", icon: StoreIcon },
            {
              href: `/store?category=${product.productType}` as Route,
              label: categoryLabel(product.productType),
            },
            { label: product.title },
          ]}
        />

        {/* Steam ライクなグラデ hero ヘッダー */}
        <header className="mt-4 overflow-hidden rounded-xl border border-border bg-gradient-to-br from-red-500/8 via-transparent to-violet-500/8 p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="category">{categoryLabel(product.productType)}</Badge>
            {/* 総合評価 Badge(GGGG): 5 件以上のレビューがあれば色付き
                ラベル + 件数を表示。未満は控えめ、ゼロなら非表示。 */}
            <ReviewBadge summary={heroSummary} size="md" />
            {/* タグ chip は /store?tag=xxx へのリンク化(VVV: タグ検索)*/}
            {product.tags.map((tag) => (
              <Link
                key={tag}
                href={`/store?tag=${encodeURIComponent(tag)}` as Route}
                className="inline-flex items-center rounded-md border border-border bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground transition hover:border-foreground/30 hover:text-foreground"
                aria-label={`タグ「${tag}」で絞り込む`}
              >
                #{tag}
              </Link>
            ))}
          </div>
          <div className="mt-3 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {product.title}
              </h1>
              {product.systemLabel && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {product.systemLabel}
                </p>
              )}
            </div>
            {/* お気に入りトグル(QQQQ): hero 右上に compact 配置。
                clicker = client component なので Server から最小の item を渡す。 */}
            <FavoriteButton
              variant="compact"
              item={{
                slug: product.slug,
                title: product.title,
                coverUrl,
                productType: product.productType,
                priceJpy: product.priceJpy,
                systemLabel: product.systemLabel,
                creator: {
                  id: product.creator.id,
                  displayName: product.creator.displayName,
                },
              }}
            />
          </div>
        </header>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
          {/* メイン画像 + スクリーンショットを 1 つの gallery に統合(EEEEE)。
              - サムネクリックで active 切替
              - 中央画像クリックで lightbox 拡大
              - lightbox 内で ← → キー or chevron で前後 */}
          <MediaGallery items={galleryItems} />
          <MetaTable
            product={product}
            salesCount={salesCount}
            reviewSummary={heroReviewSummary}
          />
        </div>

        <section className="mt-10 space-y-3">
          <h2 className="text-lg font-semibold">作品の説明</h2>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
            {product.description || "(説明はまだ登録されていません)"}
          </p>
        </section>

        {/* レビュー(Steam ライク): 集計 + 投稿フォーム + 一覧。
            購入済みでなければ閲覧のみ可能。 */}
        <section
          id="reviews"
          className="mt-12 scroll-mt-24 border-t border-border pt-8"
        >
          <ReviewSection
            productId={product.id}
            productSlug={product.slug}
            creatorId={product.creator.id}
          />
        </section>

        {/* 同じクリエイターの他作品(関連作品より上、クリエイター回遊を
            優先 — 商品詳細のキャプチャ手段としては最も強い)。0 件なら
            セクション非表示。 */}
        {otherByCreator.length > 0 && (
          <section className="mt-12 border-t border-border pt-8">
            <ProductStrip
              title={`${creatorDisplayName} の他の作品`}
              description="同じクリエイターが手がけた作品"
              products={otherByCreator}
              seeAllHref={`/creator/${product.creator.id}` as Route}
            />
          </section>
        )}

        {related.length > 0 && (
          <section className="mt-12 border-t border-border pt-8">
            <ProductStrip
              title={`同じカテゴリの作品(${categoryLabel(product.productType)})`}
              description="他の作品もチェックしてみてください"
              products={related}
              seeAllHref={`/store?category=${product.productType}`}
            />
          </section>
        )}

        {/* 「最近見た作品」(自分は除外、回遊性向上)。履歴がなければ
            何も描画されない。 */}
        <section className="mt-12 border-t border-border pt-8">
          <RecentlyViewed excludeSlug={product.slug} />
        </section>

        {/* 通報導線(自作品では非表示)。ストアの趣旨に合わない投稿を
            利用者が運営に報告できる。 */}
        {!isOwnProduct && (
          <div className="mt-10 border-t border-border pt-5">
            <ReportButton productId={product.id} loggedIn={!!user} />
          </div>
        )}
      </ThreeColumn>
    </>
  );
}

/**
 * 商品詳細のメタテーブル。Steam の「Game details」サイドパネルを
 * 参考にしたグループ化 + アイコン付き表示。
 *
 * - 作品情報 / 形式 / ライセンス / 更新 の 4 セクションに分割
 * - 各行に Lucide アイコン(視覚的な手がかり)
 * - ライセンスは Check / X で可・不可を色付きで強調
 */
function MetaTable({
  product,
  salesCount,
  reviewSummary,
}: {
  product: ProductDetail;
  salesCount: number;
  reviewSummary: ReviewSummaryShape;
}) {
  const showStats = salesCount > 0 || reviewSummary.total > 0;
  return (
    <Card className="shadow-sm">
      <CardContent className="space-y-5 p-5">
        <MetaSection title="作品情報">
          <MetaRow
            icon={Settings}
            label="対応システム"
            value={product.systemLabel ?? "—"}
          />
          <MetaRow
            icon={Users}
            label="プレイ人数"
            value={product.players ?? "—"}
          />
          <MetaRow
            icon={Clock}
            label="プレイ時間"
            value={product.playtime ?? "—"}
          />
          <MetaRow
            icon={Sparkles}
            label="推奨技能"
            value={product.recommendedSkills ?? "—"}
          />
        </MetaSection>

        <MetaSection title="形式・ライセンス">
          <MetaRow
            icon={FileType}
            label="形式"
            value={fileFormatLabel(product.fileFormat)}
          />
          <MetaRow
            icon={Briefcase}
            label="商用利用"
            value={<AllowValue allowed={product.allowCommercial} />}
          />
          <MetaRow
            icon={Repeat}
            label="二次配布"
            value={<AllowValue allowed={product.allowRedistribution} />}
          />
        </MetaSection>

        {/* 販売情報セクション(OOOO): 販売 or レビュー が 1 件以上のときだけ
            セクションごと表示。α 初期の空欄を見せない設計。 */}
        {showStats && (
          <MetaSection title="販売情報">
            {salesCount > 0 && (
              <MetaRow
                icon={ShoppingBag}
                label="販売数"
                value={`${salesCount} 件`}
              />
            )}
            {reviewSummary.total > 0 && (
              <>
                <MetaRow
                  icon={ThumbsUp}
                  label="高評価"
                  value={`${reviewSummary.positive} 件`}
                />
                <MetaRow
                  icon={ThumbsDown}
                  label="低評価"
                  value={`${reviewSummary.negative} 件`}
                />
              </>
            )}
          </MetaSection>
        )}

        <MetaSection title="更新">
          <MetaRow
            icon={Calendar}
            label="更新日"
            value={formatDate(product.updatedAt)}
          />
        </MetaSection>
      </CardContent>
    </Card>
  );
}

function MetaSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <dl className="space-y-1.5">{children}</dl>
    </div>
  );
}

function MetaRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <dt className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>{label}</span>
      </dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

function AllowValue({ allowed }: { allowed: boolean }) {
  if (allowed) {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-700">
        <Check className="h-3.5 w-3.5" aria-hidden />
        可
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <X className="h-3.5 w-3.5" aria-hidden />
      不可
    </span>
  );
}

type CtaState = "free" | "login" | "buy" | "purchased" | "own";

function PurchaseCta({ product, state }: { product: ProductDetail; state: CtaState }) {
  // 「今」の実効価格(割引・期間込み)。buy ボタンに支払額を明示する。
  const effectivePriceJpy = salePriceJpy(
    product.priceJpy,
    effectiveDiscountPercent(
      product.discountPercent,
      product.discountStartsAt,
      product.discountEndsAt,
    ),
  );
  switch (state) {
    case "free":
      return <BuyButton productId={product.id} label="無料で入手" />
    case "login":
      return (
        <Link
          href={`/login?next=${encodeURIComponent(`/store/${product.slug}`)}`}
          className={cn(buttonVariants({ variant: "primary" }), "w-full")}
        >
          ログインして購入
        </Link>
      );
    case "purchased":
      return (
        <Link
          href="/library"
          className={cn(buttonVariants({ variant: "primary" }), "w-full")}
        >
          ライブラリで見る
        </Link>
      );
    case "own":
      return (
        <Button className="w-full" disabled>
          自分の作品です
        </Button>
      );
    case "buy":
    default:
      // 支払額をボタンに明示して購入直前の迷いを減らす(割引後の実効価格)。
      return (
        <BuyButton
          productId={product.id}
          label={`${formatPrice(effectivePriceJpy)} で購入`}
        />
      );
  }
}

function PurchasePanel({
  product,
  avatarUrl,
  ctaState,
}: {
  product: ProductDetail;
  avatarUrl: string | null;
  ctaState: CtaState;
}) {
  return (
    <div className="flex flex-col gap-4">
      <PurchaseOptionsCard product={product} ctaState={ctaState} />

      <CreatorCard
        creatorId={product.creator.id}
        displayName={product.creator.displayName}
        bio={product.creator.bio}
        avatarUrl={avatarUrl}
      />
    </div>
  );
}

/**
 * 購入オプションカード。サイト全体の視覚言語に統一しつつ、価格を
 * 主役にして CTA に視線を誘導する。
 *
 * 視覚改善:
 *  - emerald/indigo グラデ(購入=value のニュアンス、success と同系)
 *  - 価格は text-3xl + tracking-tight で hero 級の存在感
 *  - メタ情報は dot ul → アイコン付き行で読みやすく
 *  - 「即時ダウンロード」を信頼信号として明示
 */
function PurchaseOptionsCard({
  product,
  ctaState,
}: {
  product: ProductDetail;
  ctaState: CtaState;
}) {
  return (
    <Card className="overflow-hidden border-border bg-gradient-to-br from-red-500/8 via-transparent to-emerald-500/8 shadow-sm">
      <CardContent className="relative space-y-4 py-5">
        <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-8 h-28 w-28 rounded-full bg-red-500/10 blur-3xl" />

        <div className="relative z-10">
          <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            購入オプション
          </h3>

          {/* 価格(主役)。割引・セール期間に対応。 */}
          <div className="mb-4 tracking-tight">
            <PriceTag
              priceJpy={product.priceJpy}
              discountPercent={product.discountPercent}
              discountStartsAt={product.discountStartsAt}
              discountEndsAt={product.discountEndsAt}
              size="lg"
              showEndsIn
            />
          </div>

          <PurchaseCta product={product} state={ctaState} />

          {ctaState === "purchased" && (
            <p className="mt-2 text-xs text-muted-foreground">
              この作品は既に購入済みです。ライブラリからダウンロードできます。
            </p>
          )}

          {/* メタ情報(MetaTable と重複するが、CTA 近くで意思決定に必要)*/}
          <ul className="mt-4 space-y-1.5 border-t border-border/60 pt-4 text-xs text-muted-foreground">
            <PurchaseMetaRow
              icon={FileType}
              label="形式"
              value={fileFormatLabel(product.fileFormat)}
            />
            <PurchaseMetaRow
              icon={Briefcase}
              label="商用利用"
              value={product.allowCommercial ? "可" : "不可"}
              positive={product.allowCommercial}
            />
            <PurchaseMetaRow
              icon={Repeat}
              label="二次配布"
              value={product.allowRedistribution ? "可" : "不可"}
              positive={product.allowRedistribution}
            />
            <PurchaseMetaRow
              icon={Check}
              label="即時ダウンロード"
              value="購入後すぐ利用可"
              positive
            />
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function PurchaseMetaRow({
  icon: Icon,
  label,
  value,
  positive,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5">
        <Icon
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            positive ? "text-emerald-600" : "text-muted-foreground/70",
          )}
          aria-hidden
        />
        <span>{label}</span>
      </span>
      <span className={positive ? "text-foreground" : "text-muted-foreground"}>
        {value}
      </span>
    </li>
  );
}

/**
 * 作者カード。サイト全体の視覚言語に統一(グラデ + 円形アバター)。
 *
 * 視覚改善:
 *  - グラデ背景(creator らしさを際立たせる indigo/rose)
 *  - アバター h-12 で拡大、画像が無い場合は表示名の頭文字を表示
 *  - 表示名を text-base font-semibold で明示、クリエイター bage 付き
 *  - bio は whitespace-pre-wrap で改行を保ちつつ leading-relaxed で読みやすく
 */
function CreatorCard({
  creatorId,
  displayName,
  bio,
  avatarUrl,
}: {
  creatorId: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
}) {
  const name = displayName || "(名称未設定)";
  const initial = name.charAt(0).toUpperCase();
  const profileHref = `/creator/${creatorId}` as Route;

  return (
    <Card className="overflow-hidden border-border bg-gradient-to-br from-red-500/8 via-transparent to-rose-500/8 shadow-sm">
      <CardContent className="relative space-y-4 py-5">
        <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-rose-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-8 h-28 w-28 rounded-full bg-red-500/10 blur-3xl" />

        <div className="relative z-10">
          <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            作者について
          </h3>

          <div className="flex items-start gap-3">
            {/* アバターをクリッカブルに(クリエイターページへ) */}
            <Link
              href={profileHref}
              className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-background text-base font-semibold text-muted-foreground transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label={`${name} のプロフィールを見る`}
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <span>{initial}</span>
              )}
            </Link>
            <div className="min-w-0 flex-1 space-y-1">
              {/* 名前もクリッカブル */}
              <Link
                href={profileHref}
                className="block truncate text-base font-semibold tracking-tight transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
              >
                {name}
              </Link>
              <Badge variant="muted" className="text-[10px]">
                クリエイター
              </Badge>
            </div>
          </div>

          {bio && (
            <p className="relative z-10 mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
              {bio}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

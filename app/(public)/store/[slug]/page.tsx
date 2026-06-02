import Link from "next/link";
import { notFound } from "next/navigation";
import { TopHeader } from "@/components/layout/top-header";
import { ThreeColumn } from "@/components/layout/three-column";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CoverImage } from "@/components/store/cover-image";
import { BuyButton } from "@/components/store/buy-button";
import { ProductStrip } from "@/components/store/product-strip";
import {
  getPublishedProductBySlug,
  listRelatedProducts,
} from "@/lib/queries/products";
import { categoryLabel, fileFormatLabel } from "@/lib/format/category";
import { formatPrice, isFree } from "@/lib/format/price";
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
  return {
    title: `${product.title} | TRPG プラットフォーム`,
    description: product.description.slice(0, 120),
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const product = await getPublishedProductBySlug(params.slug);
  if (!product) notFound();

  const coverUrl = publicCoverUrl(product.coverPath);
  const avatarUrl = publicAvatarUrl(product.creator.avatarPath);

  // CTA state — decided on the server so we never render a "buy" button to
  // someone who already owns the product.
  const user = await getCurrentUser();
  const isOwnProduct = !!user && product.creator.id === user.id;
  const purchased =
    !!user && !isOwnProduct && !isFree(product.priceJpy)
      ? await isAlreadyPurchased(user.id, product.id)
      : false;

  const ctaState: CtaState = isFree(product.priceJpy)
    ? "free"
    : isOwnProduct
      ? "own"
      : purchased
        ? "purchased"
        : user
          ? "buy"
          : "login";

  // 関連作品(同じカテゴリ)
  const related = await listRelatedProducts({
    productType: product.productType,
    excludeId: product.id,
    limit: 6,
  });

  return (
    <>
      <TopHeader />
      <ThreeColumn
        right={
          <PurchasePanel
            product={product}
            avatarUrl={avatarUrl}
            ctaState={ctaState}
          />
        }
      >
        <Breadcrumb product={product} />

        {/* Steam ライクなグラデ hero ヘッダー */}
        <header className="mt-4 overflow-hidden rounded-xl border border-border bg-gradient-to-br from-indigo-500/8 via-transparent to-violet-500/8 p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="category">{categoryLabel(product.productType)}</Badge>
            {product.tags.map((tag) => (
              <Badge key={tag} variant="muted">
                #{tag}
              </Badge>
            ))}
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            {product.title}
          </h1>
          {product.systemLabel && (
            <p className="mt-1 text-sm text-muted-foreground">
              {product.systemLabel}
            </p>
          )}
        </header>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
          <CoverImage src={coverUrl} alt={product.title} />
          <MetaTable product={product} />
        </div>

        <section className="mt-10 space-y-3">
          <h2 className="text-lg font-semibold">作品の説明</h2>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
            {product.description || "(説明はまだ登録されていません)"}
          </p>
        </section>

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
      </ThreeColumn>
    </>
  );
}

function Breadcrumb({ product }: { product: ProductDetail }) {
  return (
    <nav className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Link href="/" className="hover:text-foreground">
        ホーム
      </Link>
      <span>›</span>
      <Link
        href={`/store?category=${product.productType}`}
        className="hover:text-foreground"
      >
        {categoryLabel(product.productType)}
      </Link>
      <span>›</span>
      <span className="text-foreground">{product.title}</span>
    </nav>
  );
}

function MetaTable({ product }: { product: ProductDetail }) {
  const rows: Array<{ label: string; value: React.ReactNode }> = [
    { label: "対応システム", value: product.systemLabel ?? "—" },
    { label: "プレイ人数", value: product.players ?? "—" },
    { label: "プレイ時間", value: product.playtime ?? "—" },
    { label: "推奨技能", value: product.recommendedSkills ?? "—" },
    { label: "形式", value: fileFormatLabel(product.fileFormat) },
    { label: "商用利用", value: product.allowCommercial ? "可" : "不可" },
    { label: "二次配布", value: product.allowRedistribution ? "可" : "不可" },
    { label: "更新日", value: formatDate(product.updatedAt) },
  ];

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <dl className="divide-y divide-border">
          {rows.map((r) => (
            <div key={r.label} className="flex justify-between gap-4 py-2 text-sm">
              <dt className="text-muted-foreground">{r.label}</dt>
              <dd className="text-right">{r.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

type CtaState = "free" | "login" | "buy" | "purchased" | "own";

function PurchaseCta({ product, state }: { product: ProductDetail; state: CtaState }) {
  switch (state) {
    case "free":
      return (
        <Button className="w-full" disabled>
          無料で入手(準備中)
        </Button>
      );
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
      return <BuyButton productId={product.id} />;
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
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>購入オプション</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-2xl font-semibold">{formatPrice(product.priceJpy)}</div>
          <PurchaseCta product={product} state={ctaState} />
          {ctaState === "purchased" && (
            <p className="text-xs text-muted-foreground">
              この作品は既に購入済みです。ライブラリからダウンロードできます。
            </p>
          )}
          <ul className="space-y-1 pt-1 text-xs text-muted-foreground">
            <li>ダウンロード商品</li>
            <li>形式: {fileFormatLabel(product.fileFormat)}</li>
            <li>商用利用: {product.allowCommercial ? "可" : "不可"}</li>
            <li>二次配布: {product.allowRedistribution ? "可" : "不可"}</li>
          </ul>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>作者について</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
              {avatarUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {product.creator.displayName || "(名称未設定)"}
              </p>
            </div>
          </div>
          {product.creator.bio && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
              {product.creator.bio}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
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

import Link from "next/link";
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
  type LucideIcon,
} from "lucide-react";
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

/**
 * 商品詳細のメタテーブル。Steam の「Game details」サイドパネルを
 * 参考にしたグループ化 + アイコン付き表示。
 *
 * - 作品情報 / 形式 / ライセンス / 更新 の 4 セクションに分割
 * - 各行に Lucide アイコン(視覚的な手がかり)
 * - ライセンスは Check / X で可・不可を色付きで強調
 */
function MetaTable({ product }: { product: ProductDetail }) {
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
      <PurchaseOptionsCard product={product} ctaState={ctaState} />

      <CreatorCard
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
    <Card className="overflow-hidden border-border bg-gradient-to-br from-indigo-500/8 via-transparent to-emerald-500/8 shadow-sm">
      <CardContent className="relative space-y-4 py-5">
        <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-8 h-28 w-28 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative z-10">
          <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            購入オプション
          </h3>

          {/* 価格(主役) */}
          <div className="mb-4 text-3xl font-bold tracking-tight">
            {formatPrice(product.priceJpy)}
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
  displayName,
  bio,
  avatarUrl,
}: {
  displayName: string;
  bio: string;
  avatarUrl: string | null;
}) {
  const name = displayName || "(名称未設定)";
  const initial = name.charAt(0).toUpperCase();

  return (
    <Card className="overflow-hidden border-border bg-gradient-to-br from-indigo-500/8 via-transparent to-rose-500/8 shadow-sm">
      <CardContent className="relative space-y-4 py-5">
        <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-rose-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-8 h-28 w-28 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative z-10">
          <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            作者について
          </h3>

          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-background text-base font-semibold text-muted-foreground">
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
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate text-base font-semibold tracking-tight">
                {name}
              </p>
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

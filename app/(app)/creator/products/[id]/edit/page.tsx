import { notFound } from "next/navigation";
import { Pencil, PenSquare } from "lucide-react";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { BuilderForm } from "@/components/builder/builder-form";
import { requireCreator } from "@/lib/session/require";
import { getMyProductById } from "@/lib/queries/creator-products";
import { getPopularTags } from "@/lib/queries/tags";
import { listProductScreenshots } from "@/lib/queries/screenshots";
import type { BuilderFormValues } from "@/lib/validators/product";
import { statusLabel, statusBadgeVariant } from "@/lib/format/status";

export const metadata = { title: "作品を編集" };

interface EditPageProps {
  params: { id: string };
  searchParams: { saved?: string; published?: string };
}

export default async function EditProductPage({
  params,
  searchParams,
}: EditPageProps) {
  const user = await requireCreator();
  const product = await getMyProductById(user.id, params.id);

  // 404 also covers "exists but belongs to someone else" (Phase 5 design).
  if (!product) notFound();

  // タグサジェスト(VVV: ダブり防止)+ 既存スクショ数(XXXX UI 用)
  const [popularTags, existingScreenshots] = await Promise.all([
    getPopularTags(20),
    listProductScreenshots(product.id),
  ]);

  const initialValues: BuilderFormValues = {
    title: product.title,
    description: product.description,
    productType: product.productType,
    fileFormat: product.fileFormat,
    priceJpy: product.priceJpy,
    systemLabel: product.systemLabel ?? "",
    players: product.players ?? "",
    playtime: product.playtime ?? "",
    recommendedSkills: product.recommendedSkills ?? "",
    allowCommercial: product.allowCommercial,
    allowRedistribution: product.allowRedistribution,
    tags: product.tags,
  };

  return (
    <>
      <TopHeader />

      {/* ページ最上部の hero ヘッダー。サイト全体の視覚言語に統一。
          編集モードなので「投稿する」とは別の文言・状態バッジ付き。 */}
      <PageContainer className="pt-8">
        <Breadcrumb
          items={[
            {
              href: "/creator/products",
              label: "作品管理",
              icon: PenSquare,
            },
            { label: product.title },
          ]}
          className="mb-4"
        />
        <section className="overflow-hidden rounded-xl border border-border bg-gradient-to-br from-indigo-500/8 via-transparent to-violet-500/8 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-indigo-300 bg-indigo-50 text-indigo-700">
              <Pencil className="h-5 w-5" aria-hidden />
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  作品を編集する
                </h1>
                <Badge variant={statusBadgeVariant(product.status)}>
                  {statusLabel(product.status)}
                </Badge>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                メタデータの編集 / 表紙画像・本体ファイルの差し替え / 公開状態の切替が可能です。
              </p>
            </div>
          </div>
        </section>
      </PageContainer>

      <BuilderForm
        mode="edit"
        productId={product.id}
        currentStatus={product.status}
        publishedAt={product.publishedAt}
        initialValues={initialValues}
        savedJustNow={searchParams.saved === "1"}
        popularTags={popularTags}
        initialScreenshotsCount={existingScreenshots.length}
      />
    </>
  );
}

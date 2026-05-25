import { notFound } from "next/navigation";
import { TopHeader } from "@/components/layout/top-header";
import { BuilderForm } from "@/components/builder/builder-form";
import { requireCreator } from "@/lib/session/require";
import { getMyProductById } from "@/lib/queries/creator-products";
import type { BuilderFormValues } from "@/lib/validators/product";

export const metadata = { title: "作品を編集 | TRPG プラットフォーム" };

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
      <BuilderForm
        mode="edit"
        productId={product.id}
        currentStatus={product.status}
        publishedAt={product.publishedAt}
        initialValues={initialValues}
        savedJustNow={searchParams.saved === "1"}
      />
    </>
  );
}

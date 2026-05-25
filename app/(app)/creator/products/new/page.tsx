import { TopHeader } from "@/components/layout/top-header";
import { BuilderForm } from "@/components/builder/builder-form";
import { requireCreator } from "@/lib/session/require";
import type { BuilderFormValues } from "@/lib/validators/product";

export const metadata = { title: "作品を作成 | TRPG プラットフォーム" };

const DEFAULTS: BuilderFormValues = {
  title: "",
  description: "",
  productType: "scenario",
  fileFormat: "pdf",
  priceJpy: 0,
  systemLabel: "",
  players: "",
  playtime: "",
  recommendedSkills: "",
  allowCommercial: false,
  allowRedistribution: false,
  tags: [],
};

export default async function NewProductPage() {
  await requireCreator();

  return (
    <>
      <TopHeader />
      <BuilderForm
        mode="create"
        productId={null}
        currentStatus="draft"
        publishedAt={null}
        initialValues={DEFAULTS}
      />
    </>
  );
}

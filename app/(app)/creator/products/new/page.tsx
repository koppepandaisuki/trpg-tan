import { Upload, PenSquare } from "lucide-react";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { BuilderForm } from "@/components/builder/builder-form";
import { StripeConnectNotice } from "@/components/creator/stripe-connect-notice";
import { requireCreator } from "@/lib/session/require";
import { getPopularTags } from "@/lib/queries/tags";
import { getMyConnectStatus } from "@/lib/queries/creator-connect";
import { isAlphaAllowFreeWithoutConnectEnabled } from "@/lib/access/alpha-publish-policy";
import type { BuilderFormValues } from "@/lib/validators/product";

export const metadata = { title: "作品を投稿" };

const DEFAULTS: BuilderFormValues = {
  title: "",
  description: "",
  productType: "scenario",
  fileFormat: "pdf",
  priceJpy: 0,
  discountPercent: 0,
  discountStartsAt: null,
  discountEndsAt: null,
  systemLabel: "",
  players: "",
  playtime: "",
  recommendedSkills: "",
  allowCommercial: false,
  allowRedistribution: false,
  tags: [],
};

export default async function NewProductPage() {
  const user = await requireCreator();
  // よく使われるタグ + Stripe 接続状態を並行取得
  const [popularTags, connect] = await Promise.all([
    getPopularTags(20),
    getMyConnectStatus(user.id),
  ]);
  const alphaFreeAllowed = isAlphaAllowFreeWithoutConnectEnabled();

  return (
    <>
      <TopHeader />

      {/* ページ最上部の hero ヘッダー。サイト全体の視覚言語に統一。
          Phase 2 で Desktop App ビルダーが提供される旨を明示し、
          Web 側は「投稿(アップロード + メタデータ)」が役割であることを
          creator に伝える。 */}
      <PageContainer className="pt-8">
        <Breadcrumb
          items={[
            {
              href: "/creator/products",
              label: "作品管理",
              icon: PenSquare,
            },
            { label: "作品を投稿" },
          ]}
          className="mb-4"
        />
        <section className="overflow-hidden rounded-xl border border-border bg-gradient-to-br from-violet-500/8 via-transparent to-sky-500/8 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-violet-300 bg-violet-50 text-violet-700">
              <Upload className="h-5 w-5" aria-hidden />
            </div>
            <div className="flex-1 space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                作品を投稿する
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Web からは作品ファイル(本体 + 表紙)とメタデータを投稿できます。
                <br className="hidden sm:inline" />
                高度なビルダー(配置・効果・プリセット編集等)は Phase 2 で
                <strong> Desktop App </strong>として提供予定です。
              </p>
            </div>
          </div>
        </section>

        {/* Stripe 未接続のとき案内 + 接続ボタン(誘導を簡単に)。*/}
        {!connect.stripeChargesEnabled && (
          <StripeConnectNotice
            alphaFreeAllowed={alphaFreeAllowed}
            className="mt-4"
          />
        )}
      </PageContainer>

      <BuilderForm
        mode="create"
        productId={null}
        currentStatus="draft"
        publishedAt={null}
        initialValues={DEFAULTS}
        popularTags={popularTags}
      />
    </>
  );
}

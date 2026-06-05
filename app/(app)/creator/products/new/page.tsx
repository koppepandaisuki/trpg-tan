import Link from "next/link";
import type { Route } from "next";
import { Upload, PenSquare, AlertCircle, ArrowRight } from "lucide-react";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { buttonVariants } from "@/components/ui/button";
import { BuilderForm } from "@/components/builder/builder-form";
import { requireCreator } from "@/lib/session/require";
import { getPopularTags } from "@/lib/queries/tags";
import { getMyConnectStatus } from "@/lib/queries/creator-connect";
import { isAlphaAllowFreeWithoutConnectEnabled } from "@/lib/access/alpha-publish-policy";
import type { BuilderFormValues } from "@/lib/validators/product";
import { cn } from "@/lib/utils";

export const metadata = { title: "作品を投稿" };

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
        <section className="overflow-hidden rounded-xl border border-border bg-gradient-to-br from-violet-500/8 via-transparent to-indigo-500/8 p-6 sm:p-8">
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

        {/* Stripe 未接続のとき案内 + 接続ボタン(誘導を簡単に)。
            α で無料公開が許可されている場合は文言を和らげる。 */}
        {!connect.stripeChargesEnabled && (
          <section className="mt-4 overflow-hidden rounded-xl border border-amber-200 bg-amber-50/60 p-5">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-300 bg-amber-100 text-amber-800">
                  <AlertCircle className="h-5 w-5" aria-hidden />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold tracking-tight text-amber-900">
                    Stripe 接続が未完了です
                  </p>
                  <p className="text-xs leading-relaxed text-amber-900/80">
                    {alphaFreeAllowed
                      ? "価格 ¥0(無料)の作品は今すぐ公開できますが、有料販売には Stripe 接続(受取口座の設定)が必要です。"
                      : "作品を公開するには Stripe 接続(受取口座の設定)を完了する必要があります。"}
                  </p>
                </div>
              </div>
              <Link
                href={"/creator/onboarding" as Route}
                className={cn(
                  buttonVariants({ variant: "primary", size: "sm" }),
                  "shrink-0",
                )}
              >
                Stripe 接続を設定
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </section>
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

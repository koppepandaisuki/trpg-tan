import { notFound } from "next/navigation";
import {
  User,
  PackageOpen,
  Twitter,
  Globe,
  Receipt,
  ThumbsUp,
  Link2,
} from "lucide-react";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WorkCard } from "@/components/store/work-card";
import { CoverImage } from "@/components/store/cover-image";
import { ReviewBadge } from "@/components/review/review-badge";
import { FollowCreatorButton } from "@/components/creator/follow-creator-button";
import { getCreatorProfile } from "@/lib/queries/creator-profile";
import { getCreatorFollowState } from "@/lib/queries/creator-follow";
import { publicAvatarUrl } from "@/lib/format/storage";
import { cn } from "@/lib/utils";

/**
 * 公開クリエイタープロフィールページ。
 *
 * `/creator/[id]` で誰でも閲覧可能(認証不要)。
 *
 * 表示内容:
 *  1. hero ヘッダー: アバター + 名前 + 作品数 + bio
 *  2. 公開作品グリッド(WorkCard 流用)
 *  3. 作品がない場合: 空状態 + 「他の作品を探す」リンク
 *
 * SEO:
 *  - generateMetadata で profile.display_name を title に
 *  - description は bio の冒頭 120 字
 *  - 検索エンジンが作品とクリエイターを別々にインデックスできるよう
 *    パンくず付き
 *
 * 注意:
 *  - 自分のプロフィール編集 UI は別 PR(α 期間中は signup 時の表示名と
 *    avatar の初期値のみ。bio 編集は未実装)
 *  - SNS リンク(Twitter / Web)も α では未対応、bio に手書きしてもらう
 */

interface CreatorPageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: CreatorPageProps) {
  const profile = await getCreatorProfile(params.id);
  if (!profile) {
    return { title: "クリエイターが見つかりません" };
  }
  return {
    title: profile.displayName || "名前未設定のクリエイター",
    description:
      profile.bio.slice(0, 120) ||
      `${profile.displayName} さんの公開作品 ${profile.products.length} 件`,
  };
}

export default async function CreatorProfilePage({
  params,
}: CreatorPageProps) {
  const profile = await getCreatorProfile(params.id);
  if (!profile) notFound();

  const follow = await getCreatorFollowState(profile.id);
  const avatarUrl = publicAvatarUrl(profile.avatarPath);
  const productCount = profile.products.length;
  const displayName = profile.displayName || "名前未設定のクリエイター";

  return (
    <>
      <TopHeader />
      <PageContainer className="space-y-6 py-8">
        <Breadcrumb
          items={[{ label: displayName, icon: User }]}
        />

        {/* Hero ヘッダー(サイトの視覚言語に統一)。indigo/rose の
            グラデで「ひと」を感じさせるトーン(CreatorCard と同系)。 */}
        <Card className="overflow-hidden border-border bg-gradient-to-br from-red-500/8 via-transparent to-rose-500/8 shadow-sm">
          <CardContent className="relative py-6 sm:py-8">
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-rose-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-12 -left-10 h-40 w-40 rounded-full bg-red-500/10 blur-3xl" />

            <div className="relative z-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
              {/* アバター */}
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-background shadow-md sm:h-24 sm:w-24">
                <CoverImage
                  src={avatarUrl}
                  alt={`${displayName} のアバター`}
                  aspect="aspect-square"
                />
              </div>

              {/* 名前 + 統計バッジ + bio */}
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                    {displayName}
                  </h1>
                  <Badge variant="muted" className="text-[10px]">
                    公開作品 {productCount} 件
                  </Badge>
                  {profile.stats.totalSales > 0 && (
                    <Badge
                      variant="category"
                      className="inline-flex items-center gap-1 text-[10px]"
                    >
                      <Receipt className="h-3 w-3" aria-hidden />
                      累計購入 {profile.stats.totalSales} 件
                    </Badge>
                  )}
                  {profile.stats.reviews.total > 0 && (
                    <ReviewBadge
                      summary={{
                        total: profile.stats.reviews.total,
                        positive: profile.stats.reviews.positive,
                        avgStars: profile.stats.reviews.avgStars,
                        label: profile.stats.reviews.label,
                      }}
                      size="sm"
                    />
                  )}
                </div>
                {profile.bio ? (
                  <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {profile.bio}
                  </p>
                ) : (
                  <p className="text-sm italic text-muted-foreground/70">
                    自己紹介は未設定です
                  </p>
                )}

                {/* SNS リンク(Twitter / Web + クリエイターが任意で足した
                    各種リンク)。1 つも無ければ行ごと出さない。 */}
                {(profile.twitterHandle ||
                  profile.websiteUrl ||
                  profile.socialLinks.length > 0) && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {profile.twitterHandle && (
                      <SnsLink
                        href={`https://twitter.com/${profile.twitterHandle}`}
                        icon={Twitter}
                        label={`@${profile.twitterHandle}`}
                        tone="sky"
                      />
                    )}
                    {profile.websiteUrl && (
                      <SnsLink
                        href={profile.websiteUrl}
                        icon={Globe}
                        label="Web サイト"
                        tone="emerald"
                      />
                    )}
                    {profile.socialLinks.map((link, i) => (
                      <SnsLink
                        key={`${i}-${link.url}`}
                        href={link.url}
                        icon={Link2}
                        label={link.label}
                        tone="neutral"
                      />
                    ))}
                  </div>
                )}

                {/* フォロー(DB 永続・SNS 的)+ フォロワー数。 */}
                <div className="pt-1">
                  <FollowCreatorButton
                    creatorId={profile.id}
                    initialFollowing={follow.isFollowing}
                    initialCount={follow.count}
                    isSelf={follow.isSelf}
                    isAuthed={follow.isAuthed}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 公開作品セクション */}
        {productCount === 0 ? (
          <Card className="shadow-sm">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-muted bg-muted/50 text-muted-foreground">
                <PackageOpen className="h-6 w-6" aria-hidden />
              </div>
              <p className="text-sm font-medium">
                公開中の作品はまだありません
              </p>
              <p className="max-w-sm text-xs text-muted-foreground">
                このクリエイターが作品を公開すると、ここに表示されます。
              </p>
            </CardContent>
          </Card>
        ) : (
          <section className="space-y-3">
            <div className="flex items-baseline gap-2">
              <h2 className="text-lg font-semibold tracking-tight">
                公開作品
              </h2>
              <span className="text-xs text-muted-foreground">
                {productCount} 件
              </span>
            </div>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 lg:gap-y-8 xl:grid-cols-5">
              {profile.products.map((product) => (
                <li key={product.id}>
                  <WorkCard product={product} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </PageContainer>
    </>
  );
}

/**
 * SNS リンク(Twitter / Web サイト)用の小さな chip。tone で色違いの
 * 視覚記号にする(Twitter = sky、Web = emerald)。
 *
 * target="_blank" + rel="noopener noreferrer me" で:
 *  - 新タブで開く
 *  - opener を渡さない(タブナビ攻撃防止)
 *  - rel=me で「これは私のサイト」と明示(IndieAuth 等の hint)
 */
function SnsLink({
  href,
  icon: Icon,
  label,
  tone,
}: {
  href: string;
  icon: typeof Twitter;
  label: string;
  tone: "sky" | "emerald" | "neutral";
}) {
  const toneClass =
    tone === "sky"
      ? "border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100"
      : tone === "emerald"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100"
        : "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer me"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition",
        toneClass,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      <span className="line-clamp-1 max-w-[200px]">{label}</span>
    </a>
  );
}

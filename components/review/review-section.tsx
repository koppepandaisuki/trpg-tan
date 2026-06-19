import Link from "next/link";
import type { Route } from "next";
import {
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Lock,
  User as UserIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  getProductReviews,
  getReviewSummary,
  getMyReview,
  type ReviewLabel,
  type ReviewReply,
} from "@/lib/queries/reviews";
import { isAlreadyPurchased } from "@/lib/access/purchase-access";
import { getCurrentUser } from "@/lib/session/get-user";
import { publicAvatarUrl } from "@/lib/format/storage";
import { ReviewForm } from "@/components/review/review-form";
import { ReplyForm } from "@/components/review/reply-form";
import { HelpfulButton } from "@/components/review/helpful-button";
import { CollapsibleReviewList } from "@/components/review/collapsible-review-list";
import { cn } from "@/lib/utils";

/**
 * 商品詳細ページの「レビュー」セクション。Steam ライクな集計表示
 * (positive/negative + 総合評価ラベル)+ 自分の投稿フォーム +
 * 全レビュー一覧。
 *
 * Server Component:
 *   - 認証状態と購入状態を見て、投稿フォーム / ログイン誘導 /
 *     購入誘導 / 編集フォーム を出し分け
 *   - 集計とレビュー一覧を並行 fetch
 *
 * ReviewForm は Client Component(投稿アクション呼び出し用)。
 */
/**
 * 「creator 自身」(その商品の作者)であるかを示すフラグ。NNNN で
 * レビューに対する返信フォームを出すかの判定に使う。
 */
export async function ReviewSection({
  productId,
  productSlug,
  creatorId,
}: {
  productId: string;
  productSlug: string;
  /** 商品の creator_id(本 user がこれと一致したら返信ボタンを出す)*/
  creatorId: string;
}) {
  const user = await getCurrentUser();
  const isCreatorOfThisProduct = Boolean(user && user.id === creatorId);

  // 並行 fetch(getProductReviews には viewer の id を渡して
  // 「役に立った」投票の自分の状態を集計する)
  const [summary, reviews, purchased, myReview] = await Promise.all([
    getReviewSummary(productId),
    getProductReviews(productId, user?.id ?? null),
    user ? isAlreadyPurchased(user.id, productId) : Promise.resolve(false),
    user ? getMyReview(productId, user.id) : Promise.resolve(null),
  ]);

  return (
    <section className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-sky-700">
          <MessageSquare className="h-4 w-4" aria-hidden />
        </div>
        <div className="space-y-0.5">
          <h2 className="text-lg font-semibold tracking-tight">レビュー</h2>
          <p className="text-xs text-muted-foreground">
            購入してプレイしたユーザーが、プレイ後の感想を投稿できます
          </p>
        </div>
      </div>

      {/* 集計カード */}
      <Card className="shadow-sm">
        <CardContent className="space-y-4 py-5">
          <div className="flex flex-wrap items-center gap-3">
            <ReviewLabelBadge label={summary.label} />
            <span className="text-xs text-muted-foreground">
              {summary.total} 件のレビュー
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 font-medium text-emerald-800">
              <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
              高評価 {summary.positive}
            </div>
            <div className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 font-medium text-rose-800">
              <ThumbsDown className="h-3.5 w-3.5" aria-hidden />
              低評価 {summary.negative}
            </div>
            {summary.positiveRatio !== null && (
              <span className="text-muted-foreground">
                好評率 {Math.round(summary.positiveRatio * 100)}%
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 投稿エリア(認証 + 購入で分岐)*/}
      {user ? (
        purchased ? (
          <ReviewForm
            productId={productId}
            productSlug={productSlug}
            initialRating={myReview?.rating ?? null}
            initialComment={myReview?.comment ?? ""}
          />
        ) : (
          <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
            <Lock className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            購入済みユーザーのみレビューを投稿できます。
          </div>
        )
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-border bg-muted/30 px-4 py-3 text-xs">
          <span className="text-muted-foreground">
            <Lock className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            レビューを投稿するにはログインが必要です
          </span>
          <Link
            href={`/login?next=/store/${productSlug}` as Route}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            ログイン
          </Link>
        </div>
      )}

      {/* レビュー一覧(YYYYY: 最初の 3 件のみ表示、残りは展開)*/}
      {reviews.length > 0 ? (
        <CollapsibleReviewList initialCount={3}>
          {reviews.map((r) => (
            <li key={r.id} className="space-y-2">
              <ReviewItemCard
                reviewId={r.id}
                productSlug={productSlug}
                rating={r.rating}
                comment={r.comment}
                userName={r.user.displayName}
                avatarUrl={publicAvatarUrl(r.user.avatarPath)}
                createdAt={r.createdAt}
                updatedAt={r.updatedAt}
                helpfulCount={r.helpfulCount}
                viewerVoted={r.viewerVoted}
                canVote={Boolean(user)}
              />
              {/* 公式 reply(あれば誰でも見える)*/}
              {r.reply && (
                <CreatorReplyCard reply={r.reply} />
              )}
              {/* creator 自身が見ているとき、返信フォームを出す
                  (既存返信があれば編集モード、なければ新規モード) */}
              {isCreatorOfThisProduct && (
                <ReplyForm
                  reviewId={r.id}
                  productSlug={productSlug}
                  initialBody={r.reply?.body ?? ""}
                  hasExistingReply={Boolean(r.reply)}
                />
              )}
            </li>
          ))}
        </CollapsibleReviewList>
      ) : (
        <Card className="shadow-sm">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            まだレビューはありません。最初のレビューを投稿してみませんか?
          </CardContent>
        </Card>
      )}
    </section>
  );
}

/**
 * Steam 風の総合評価ラベルを色付き Badge に。
 * 評価が高いほど positive な配色(emerald)、低いほど rose 寄りに。
 */
function ReviewLabelBadge({ label }: { label: ReviewLabel }) {
  // 評価が無いもの(0 件)は「評価なし」ラベルを出さず、何も描画しない。
  if (label === "評価なし") return null;
  const tones: Record<ReviewLabel, string> = {
    圧倒的に好評: "border-emerald-300 bg-emerald-100 text-emerald-900",
    非常に好評: "border-emerald-300 bg-emerald-50 text-emerald-800",
    ほぼ好評: "border-sky-300 bg-sky-50 text-sky-800",
    賛否両論: "border-amber-300 bg-amber-50 text-amber-900",
    やや不評: "border-orange-300 bg-orange-50 text-orange-900",
    不評: "border-rose-300 bg-rose-50 text-rose-900",
    圧倒的に不評: "border-rose-400 bg-rose-100 text-rose-950",
    評価不足: "border-slate-300 bg-slate-50 text-slate-700",
    評価なし: "border-slate-300 bg-slate-50 text-slate-700",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold",
        tones[label],
      )}
    >
      {label}
    </span>
  );
}

function ReviewItemCard({
  reviewId,
  productSlug,
  rating,
  comment,
  userName,
  avatarUrl,
  createdAt,
  updatedAt,
  helpfulCount,
  viewerVoted,
  canVote,
}: {
  reviewId: string;
  productSlug: string;
  rating: "positive" | "negative";
  comment: string;
  userName: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  helpfulCount: number;
  viewerVoted: boolean;
  canVote: boolean;
}) {
  const name = userName || "(名称未設定)";
  const isEdited = createdAt !== updatedAt;

  return (
    <Card className="shadow-sm">
      <CardContent className="space-y-2 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <UserIcon className="h-4 w-4" aria-hidden />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{name}</p>
              <p className="text-[10px] text-muted-foreground">
                {formatDate(createdAt)}
                {isEdited && " · 編集済"}
              </p>
            </div>
          </div>
          <Badge
            variant="muted"
            className={cn(
              "shrink-0 text-[10px]",
              rating === "positive"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-800",
            )}
          >
            {rating === "positive" ? (
              <span className="inline-flex items-center gap-1">
                <ThumbsUp className="h-3 w-3" aria-hidden /> 高評価
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <ThumbsDown className="h-3 w-3" aria-hidden /> 低評価
              </span>
            )}
          </Badge>
        </div>
        {comment && (
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
            {comment}
          </p>
        )}
        {/* 「役に立った」投票(LLLLL)*/}
        <div className="pt-1">
          <HelpfulButton
            reviewId={reviewId}
            productSlug={productSlug}
            initialCount={helpfulCount}
            initialVoted={viewerVoted}
            canVote={canVote}
          />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * creator からの公式返信を装飾的に表示するカード(Steam の Developer's
 * Response 相当)。アイコン付き + indigo 系で「公式回答」を強調。
 */
function CreatorReplyCard({ reply }: { reply: ReviewReply }) {
  const name = reply.creator.displayName || "(名称未設定)";
  const avatarUrl = publicAvatarUrl(reply.creator.avatarPath);
  const isEdited = reply.createdAt !== reply.updatedAt;

  return (
    <Card className="ml-4 border-sky-200 bg-sky-50/40 shadow-none sm:ml-8">
      <CardContent className="space-y-1.5 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="h-6 w-6 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <UserIcon className="h-3 w-3" aria-hidden />
                </div>
              )}
            </div>
            <p className="truncate text-xs font-medium text-sky-900">
              {name}
              <Badge
                variant="muted"
                className="ml-1.5 border-sky-200 bg-sky-100 text-[9px] text-sky-800"
              >
                作者
              </Badge>
            </p>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {formatDate(reply.createdAt)}
            {isEdited && " · 編集済"}
          </p>
        </div>
        <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground/90">
          {reply.body}
        </p>
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

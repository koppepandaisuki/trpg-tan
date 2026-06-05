import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ReviewRating } from "@/lib/validators/review";

/**
 * 作品レビューのクエリ群(取得 + 集計)。Steam ライク UI 用に
 * positive/negative の集計 + 一覧 + 自分の投稿状態 を返す。
 *
 * 公開 read 前提なので RLS は全許可(0016 migration)。
 */

export interface ReviewReply {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  creator: {
    id: string;
    displayName: string;
    avatarPath: string | null;
  };
}

export interface ReviewItem {
  id: string;
  rating: ReviewRating;
  comment: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    displayName: string;
    avatarPath: string | null;
  };
  /** creator からの公式返信(あれば)。1 レビュー 1 返信。*/
  reply: ReviewReply | null;
  /** 「役に立った」票数(LLLLL)。*/
  helpfulCount: number;
  /** 閲覧者が「役に立った」を押しているか(未ログインは常に false)。*/
  viewerVoted: boolean;
}

export interface ReviewSummary {
  total: number;
  positive: number;
  negative: number;
  /** positive ratio(0–1)。total = 0 のときは null */
  positiveRatio: number | null;
  /** Steam 風の総合評価ラベル */
  label: ReviewLabel;
}

export type ReviewLabel =
  | "圧倒的に好評"
  | "非常に好評"
  | "ほぼ好評"
  | "賛否両論"
  | "やや不評"
  | "不評"
  | "圧倒的に不評"
  | "評価不足"
  | "評価なし";

/**
 * 商品の全レビューを取得(新しい順)。コメント付き / 無しの両方を含む。
 * user 情報は public_profiles から一括取得。
 *
 * viewerId を渡すと、各レビューの「役に立った」票数 + 閲覧者自身の投票
 * 状態(viewerVoted)を集計する(LLLLL)。未ログインなら null を渡す。
 */
export async function getProductReviews(
  productId: string,
  viewerId?: string | null,
): Promise<ReviewItem[]> {
  const supabase = createClient();

  const { data: reviewRows, error } = await supabase
    .from("product_reviews")
    .select("id, user_id, rating, comment, created_at, updated_at")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getProductReviews] failed", error);
    return [];
  }
  if (!reviewRows || reviewRows.length === 0) return [];

  const userIds = Array.from(new Set(reviewRows.map((r) => r.user_id)));
  const { data: profileRows } = await supabase
    .from("public_profiles")
    .select("id, display_name, avatar_path")
    .in("id", userIds);

  const profileMap = new Map(
    (profileRows ?? []).map((p) => [p.id, p] as const),
  );

  // 各レビューに紐づく creator reply を一括取得(NNNN)。
  // reply の creator profile も一括取得して名前 / アバターを埋め込む。
  const reviewIds = reviewRows.map((r) => r.id);
  const [replyMap, voteInfo] = await Promise.all([
    fetchRepliesByReviewIds(reviewIds),
    fetchHelpfulVotes(reviewIds, viewerId ?? null),
  ]);

  return reviewRows.map((r) => {
    const profile = profileMap.get(r.user_id);
    return {
      id: r.id,
      rating: r.rating as ReviewRating,
      comment: r.comment ?? "",
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      user: {
        id: r.user_id,
        displayName: profile?.display_name ?? "",
        avatarPath: profile?.avatar_path ?? null,
      },
      reply: replyMap.get(r.id) ?? null,
      helpfulCount: voteInfo.counts.get(r.id) ?? 0,
      viewerVoted: voteInfo.viewerVoted.has(r.id),
    };
  });
}

/**
 * 複数 review の「役に立った」票を一括集計(N+1 防止、LLLLL)。
 *  - counts: review_id → 票数
 *  - viewerVoted: viewerId が投票済の review_id 集合
 */
async function fetchHelpfulVotes(
  reviewIds: string[],
  viewerId: string | null,
): Promise<{ counts: Map<string, number>; viewerVoted: Set<string> }> {
  const counts = new Map<string, number>();
  const viewerVoted = new Set<string>();
  if (reviewIds.length === 0) return { counts, viewerVoted };

  const supabase = createClient();
  const { data, error } = await supabase
    .from("review_votes")
    .select("review_id, user_id")
    .in("review_id", reviewIds);

  if (error) {
    console.error("[fetchHelpfulVotes] failed", error);
    return { counts, viewerVoted };
  }

  for (const row of data ?? []) {
    counts.set(row.review_id, (counts.get(row.review_id) ?? 0) + 1);
    if (viewerId && row.user_id === viewerId) {
      viewerVoted.add(row.review_id);
    }
  }
  return { counts, viewerVoted };
}

/**
 * 複数 review に対する creator 返信を一括取得(N+1 防止)。
 * creator profile も同時に拾って ReviewReply 形にして返す。
 */
async function fetchRepliesByReviewIds(
  reviewIds: string[],
): Promise<Map<string, ReviewReply>> {
  const result = new Map<string, ReviewReply>();
  if (reviewIds.length === 0) return result;

  const supabase = createClient();
  const { data: replyRows, error } = await supabase
    .from("review_replies")
    .select("id, review_id, creator_id, body, created_at, updated_at")
    .in("review_id", reviewIds);

  if (error) {
    console.error("[fetchRepliesByReviewIds] failed", error);
    return result;
  }
  if (!replyRows || replyRows.length === 0) return result;

  const creatorIds = Array.from(new Set(replyRows.map((r) => r.creator_id)));
  const { data: profileRows } = await supabase
    .from("public_profiles")
    .select("id, display_name, avatar_path")
    .in("id", creatorIds);
  const profileMap = new Map(
    (profileRows ?? []).map((p) => [p.id, p] as const),
  );

  for (const r of replyRows) {
    const profile = profileMap.get(r.creator_id);
    result.set(r.review_id, {
      id: r.id,
      body: r.body ?? "",
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      creator: {
        id: r.creator_id,
        displayName: profile?.display_name ?? "",
        avatarPath: profile?.avatar_path ?? null,
      },
    });
  }
  return result;
}

/**
 * 商品の評価集計(positive / negative count + Steam 風ラベル)。
 *
 * 別クエリにすることで、商品一覧側で軽量に集計だけ取れる用途にも
 * 拡張可能。現状は商品詳細ページから呼ぶ。
 */
export async function getReviewSummary(
  productId: string,
): Promise<ReviewSummary> {
  const supabase = createClient();

  const { data: rows, error } = await supabase
    .from("product_reviews")
    .select("rating")
    .eq("product_id", productId);

  if (error) {
    console.error("[getReviewSummary] failed", error);
    return emptySummary();
  }

  let positive = 0;
  let negative = 0;
  for (const r of rows ?? []) {
    if (r.rating === "positive") positive++;
    else if (r.rating === "negative") negative++;
  }
  const total = positive + negative;

  return {
    total,
    positive,
    negative,
    positiveRatio: total === 0 ? null : positive / total,
    label: computeReviewLabel(positive, total),
  };
}

/**
 * 自分のレビューを取得(あれば)。Server Component で
 * 「投稿フォーム or 編集フォーム」の出し分けに使う。
 */
export async function getMyReview(
  productId: string,
  userId: string,
): Promise<ReviewItem | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("product_reviews")
    .select("id, user_id, rating, comment, created_at, updated_at")
    .eq("product_id", productId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[getMyReview] failed", error);
    return null;
  }
  if (!data) return null;

  // displayName / avatar / reply / helpful は本人フォームには不要なので簡略
  return {
    id: data.id,
    rating: data.rating as ReviewRating,
    comment: data.comment ?? "",
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    user: { id: data.user_id, displayName: "", avatarPath: null },
    reply: null,
    helpfulCount: 0,
    viewerVoted: false,
  };
}

/**
 * Steam 風の総合評価ラベルを算出。
 *
 * 基準(Steam を参考に簡略化):
 *   - 5 件未満: 「評価不足」(α 期間中は緩めに 5 件で確定)
 *   - positive ratio:
 *     95%+: 圧倒的に好評
 *     80–94%: 非常に好評
 *     70–79%: ほぼ好評
 *     40–69%: 賛否両論
 *     20–39%: やや不評
 *     5–19%: 不評
 *     0–4%: 圧倒的に不評
 */
function computeReviewLabel(positive: number, total: number): ReviewLabel {
  if (total === 0) return "評価なし";
  if (total < 5) return "評価不足";
  const ratio = positive / total;
  if (ratio >= 0.95) return "圧倒的に好評";
  if (ratio >= 0.8) return "非常に好評";
  if (ratio >= 0.7) return "ほぼ好評";
  if (ratio >= 0.4) return "賛否両論";
  if (ratio >= 0.2) return "やや不評";
  if (ratio >= 0.05) return "不評";
  return "圧倒的に不評";
}

function emptySummary(): ReviewSummary {
  return {
    total: 0,
    positive: 0,
    negative: 0,
    positiveRatio: null,
    label: "評価なし",
  };
}

/**
 * 複数 product の評価集計を一括取得。商品一覧で各 card に
 * 軽量サマリ(total / positive / label)を載せるために使う。
 *
 * `product_reviews` を `product_id in (...)` で 1 クエリだけ。0 件 / 評価
 * 未満の product は Map に含めない(呼び出し側は `Map.get(id) ?? null`
 * で取り扱う)。
 */
export async function fetchReviewSummariesByProductIds(
  productIds: string[],
): Promise<Map<string, { total: number; positive: number; label: ReviewLabel }>> {
  const result = new Map<
    string,
    { total: number; positive: number; label: ReviewLabel }
  >();
  if (productIds.length === 0) return result;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("product_reviews")
    .select("product_id, rating")
    .in("product_id", productIds);

  if (error) {
    console.error("[fetchReviewSummariesByProductIds] failed", error);
    return result;
  }

  // product_id ごとに positive / total を集計
  const counts = new Map<string, { positive: number; total: number }>();
  for (const row of data ?? []) {
    const c = counts.get(row.product_id) ?? { positive: 0, total: 0 };
    c.total++;
    if (row.rating === "positive") c.positive++;
    counts.set(row.product_id, c);
  }

  for (const [id, c] of counts.entries()) {
    result.set(id, {
      total: c.total,
      positive: c.positive,
      label: computeReviewLabel(c.positive, c.total),
    });
  }
  return result;
}

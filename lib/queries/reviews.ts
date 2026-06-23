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
  /** 5 段階の星評価(1..5)。*/
  stars: number;
  /** 後方互換の二択(stars>=4 を高評価とみなす)。*/
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
  /** 平均星(1–5)。total = 0 のときは null */
  avgStars: number | null;
  /** 平均星から導く Steam 風の総合評価ラベル */
  label: ReviewLabel;
}

/** 後方互換: 旧 rating しか無い行のための星フォールバック。*/
function starsOf(row: { stars: number | null; rating: string }): number {
  if (typeof row.stars === "number" && row.stars >= 1 && row.stars <= 5) {
    return row.stars;
  }
  return row.rating === "positive" ? 5 : 2;
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
    .select("id, user_id, stars, rating, comment, created_at, updated_at")
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
      stars: starsOf(r),
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
    .select("stars, rating")
    .eq("product_id", productId);

  if (error) {
    console.error("[getReviewSummary] failed", error);
    return emptySummary();
  }

  let positive = 0;
  let negative = 0;
  let starSum = 0;
  const total = (rows ?? []).length;
  for (const r of rows ?? []) {
    const s = starsOf(r);
    starSum += s;
    if (s >= 4) positive++;
    else if (s <= 2) negative++;
  }
  const avgStars = total === 0 ? null : starSum / total;

  return {
    total,
    positive,
    negative,
    positiveRatio: total === 0 ? null : positive / total,
    avgStars,
    label: computeStarLabel(avgStars, total),
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
    .select("id, user_id, stars, rating, comment, created_at, updated_at")
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
    stars: starsOf(data),
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
 * 指定ユーザーが既にレビュー済みの product_id 集合を一括取得。
 * ライブラリで「レビューを書く / レビュー済み・編集」を出し分けるのに使う。
 *
 * product_reviews は公開 read(0016)なので user_id 一致でそのまま引ける。
 * 0 件 / 空 productIds は空 Set を返す(呼び出し側は has() で扱う)。
 */
export async function fetchMyReviewedProductIds(
  userId: string,
  productIds: string[],
): Promise<Set<string>> {
  const result = new Set<string>();
  if (productIds.length === 0) return result;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("product_reviews")
    .select("product_id")
    .eq("user_id", userId)
    .in("product_id", productIds);

  if (error) {
    console.error("[fetchMyReviewedProductIds] failed", error);
    return result;
  }
  for (const r of data ?? []) result.add(r.product_id);
  return result;
}

/**
 * 平均星(1–5)から Steam 風の総合評価ラベルを算出。
 *
 * 基準:
 *   - 0 件: 評価なし / 3 件未満: 評価不足(星は二択より情報量が多いので緩め)
 *   - 平均星:
 *     4.5+: 圧倒的に好評
 *     4.0–4.49: 非常に好評
 *     3.5–3.99: ほぼ好評
 *     2.5–3.49: 賛否両論
 *     2.0–2.49: やや不評
 *     1.5–1.99: 不評
 *     〜1.49: 圧倒的に不評
 */
export function computeStarLabel(
  avgStars: number | null,
  total: number,
): ReviewLabel {
  if (total === 0 || avgStars === null) return "評価なし";
  if (total < 3) return "評価不足";
  if (avgStars >= 4.5) return "圧倒的に好評";
  if (avgStars >= 4.0) return "非常に好評";
  if (avgStars >= 3.5) return "ほぼ好評";
  if (avgStars >= 2.5) return "賛否両論";
  if (avgStars >= 2.0) return "やや不評";
  if (avgStars >= 1.5) return "不評";
  return "圧倒的に不評";
}

function emptySummary(): ReviewSummary {
  return {
    total: 0,
    positive: 0,
    negative: 0,
    positiveRatio: null,
    avgStars: null,
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
): Promise<
  Map<
    string,
    { total: number; positive: number; avgStars: number; label: ReviewLabel }
  >
> {
  const result = new Map<
    string,
    { total: number; positive: number; avgStars: number; label: ReviewLabel }
  >();
  if (productIds.length === 0) return result;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("product_reviews")
    .select("product_id, stars, rating")
    .in("product_id", productIds);

  if (error) {
    console.error("[fetchReviewSummariesByProductIds] failed", error);
    return result;
  }

  // product_id ごとに 平均星 / positive / total を集計
  const counts = new Map<
    string,
    { positive: number; total: number; starSum: number }
  >();
  for (const row of data ?? []) {
    const c = counts.get(row.product_id) ?? {
      positive: 0,
      total: 0,
      starSum: 0,
    };
    const s = starsOf(row);
    c.total++;
    c.starSum += s;
    if (s >= 4) c.positive++;
    counts.set(row.product_id, c);
  }

  for (const [id, c] of counts.entries()) {
    const avgStars = c.total === 0 ? 0 : c.starSum / c.total;
    result.set(id, {
      total: c.total,
      positive: c.positive,
      avgStars,
      label: computeStarLabel(avgStars, c.total),
    });
  }
  return result;
}

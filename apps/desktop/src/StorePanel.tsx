import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Store,
  Search,
  FileText,
  BookOpen,
  Map as MapIcon,
  Palette,
  Music,
  Flame,
  Sparkles,
  ThumbsUp,
  Users,
  ShoppingCart,
  LibraryBig,
  LayoutGrid,
  Boxes,
  Trophy,
  ChevronRight,
  Star,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { toast } from "./Toasts";
import { requireLogin } from "./LoginGate";
import { useAuth } from "./useAuth";
import { supabaseConfigured } from "./supabase";
import { SkelGrid, SkelStoreHome } from "./Skeleton";
import { EmptyState } from "./EmptyState";
import { PRODUCT_TYPE_LABEL, FILE_FORMAT_LABEL } from "./library-remote";
import type { RemoteProductType } from "./library-remote";
import {
  fetchStore,
  fetchStoreDetail,
  fetchStoreHome,
  fetchStoreCreators,
  fetchScreenshotUrls,
  fetchMyPurchasedIds,
  fetchMyReview,
  submitReview,
  deleteMyReview,
  formatPriceJpy,
  salePriceJpy,
  effectiveDiscountPercent,
  webProductUrl,
  type StoreItem,
  type StoreDetail,
  type StoreHome,
  type StoreSort,
  type StoreReviewSummary,
  type FeaturedItem,
  type StoreCreator,
  type TopCreatorEntry,
} from "./store-remote";

/**
 * ストア(メインペイン)。Steam ライクな 3 面構成:
 *  - ホーム: 大型カルーセル(フィーチャー) + 急上昇 / 新着 / 好評 /
 *    ジャンル別の横スクロール・ストリップ
 *  - 一覧: カテゴリ / 検索 / 並び順 / ページングのグリッド
 *  - 詳細: ギャラリー / 説明 / メタ / レビュー / 購入導線(決済は Web)
 */

const CATEGORIES: { key: RemoteProductType | null; label: string }[] = [
  { key: null, label: "すべて" },
  { key: "full_package", label: "フルパッケージ" },
  { key: "scenario", label: "シナリオ" },
  { key: "rulebook", label: "ルールブック" },
  { key: "character_art", label: "キャラ素材" },
  { key: "map", label: "マップ" },
  { key: "bgm_audio", label: "BGM/音声" },
];

/** ジャンルのアイコン(lucide。Web 側と同じ語彙)。 */
const CATEGORY_ICON: Record<RemoteProductType, ReactNode> = {
  full_package: <Boxes size={14} />,
  scenario: <FileText size={14} />,
  rulebook: <BookOpen size={14} />,
  character_art: <Palette size={14} />,
  map: <MapIcon size={14} />,
  bgm_audio: <Music size={14} />,
};

/**
 * 「カテゴリで探す」のサブカード(Web ホームと同じラベル / 説明 / 配色)。
 * フルパッケージは“目玉”として上の大型カードに分離するので、ここには含めない。
 */
const CAT_CARDS: {
  key: RemoteProductType;
  icon: ReactNode;
  label: string;
  sub: string;
  tone: string;
}[] = [
  { key: "scenario", icon: <FileText size={17} />, label: "シナリオ", sub: "ストーリーと舞台設定", tone: "green" },
  { key: "rulebook", icon: <BookOpen size={17} />, label: "ルールブック", sub: "ハウスルール・追加システム", tone: "green" },
  { key: "map", icon: <MapIcon size={17} />, label: "マップ・バトルマップ", sub: "戦闘マップ・地図", tone: "gold" },
  { key: "character_art", icon: <Palette size={17} />, label: "アートワーク", sub: "立ち絵・アートワーク", tone: "rose" },
  { key: "bgm_audio", icon: <Music size={17} />, label: "BGM・効果音", sub: "BGM・効果音", tone: "violet" },
];

/** セクション見出しのアクセント色(アイコンチップの色味)。 */
type SecTone = "sky" | "mint" | "gold" | "rose" | "violet" | "coral";

/** カテゴリ別ストリップの見出し色(catcard の配色と対応)。 */
const CAT_TONE: Record<RemoteProductType, SecTone> = {
  full_package: "sky",
  scenario: "sky",
  rulebook: "mint",
  map: "gold",
  character_art: "rose",
  bgm_audio: "violet",
};

/**
 * ストアホーム共通のセクション見出し。アイコンチップ + タイトル + 補足 +
 * 右端アクション。全セクションで同じ語彙にすることでリズムと階層を作る。
 */
function SecHead({
  icon,
  tone,
  title,
  sub,
  action,
}: {
  icon: ReactNode;
  tone: SecTone;
  title: string;
  sub?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="sec-head">
      <span className={`sec-ic tone-${tone}`}>{icon}</span>
      <div className="sec-headcopy">
        <h3 className="sec-title">{title}</h3>
        {sub && <p className="sec-sub muted">{sub}</p>}
      </div>
      {action && (
        <button className="sec-action" onClick={action.onClick}>
          {action.label}
          <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
}

function reviewTone(label: string): string {
  if (label.includes("好評")) return "ok";
  if (label === "賛否両論") return "mid";
  if (label.includes("不評")) return "bad";
  return "none";
}

/** 星の表示(平均星を 0.5 刻みで塗り分け)。size は px。 */
function StarsDisplay({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="stars-row" aria-label={`${value.toFixed(1)} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)));
        return (
          <span
            key={i}
            className="star-cell"
            style={{ width: size, height: size }}
          >
            <Star className="star-bg" size={size} strokeWidth={1.5} />
            <span className="star-fg" style={{ width: `${fill * 100}%` }}>
              <Star size={size} strokeWidth={1.5} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** 星の入力(1..5 をクリック / ホバー)。 */
function StarsInput({
  value,
  onChange,
  size = 26,
}: {
  value: number;
  onChange: (n: number) => void;
  size?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;
  return (
    <span className="stars-row input">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          className={`star-btn ${shown >= i ? "on" : ""}`}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
          onClick={() => onChange(i)}
          aria-label={`${i} つ星`}
          title={`${i} つ星`}
        >
          <Star size={size} strokeWidth={1.5} />
        </button>
      ))}
    </span>
  );
}

const STAR_WORD: Record<number, string> = {
  1: "いまひとつ",
  2: "もう少し",
  3: "ふつう",
  4: "良かった",
  5: "最高！",
};

function ReviewBadge({ review }: { review: StoreReviewSummary | null }) {
  // 評価が無いもの(0 件)は何も表示しない。
  if (!review || review.total === 0) return null;
  return (
    <span className={`store-rev star ${reviewTone(review.label)}`} title={review.label}>
      <Star size={12} className="store-rev-star" />
      {review.avgStars.toFixed(1)}（{review.total}）
    </span>
  );
}

/**
 * 価格表示(割引・セール期間対応)。Steam 風に「-XX% / 定価(取り消し線) / 割引後」。
 * 割引が効いていない(率0 or 期間外 or 無料)ときは普通の価格だけ。
 */
function PriceTag({
  item,
  size,
}: {
  item: Pick<
    StoreItem,
    "priceJpy" | "discountPercent" | "discountStartsAt" | "discountEndsAt"
  >;
  size?: "lg";
}) {
  const eff = effectiveDiscountPercent(
    item.discountPercent,
    item.discountStartsAt,
    item.discountEndsAt,
  );
  const onSale = item.priceJpy > 0 && eff > 0;
  const now = formatPriceJpy(onSale ? salePriceJpy(item.priceJpy, eff) : item.priceJpy);
  const cls = size === "lg" ? "price-now lg" : "price-now";
  if (!onSale) return <span className={cls}>{now}</span>;
  return (
    <span className="price-sale">
      <span className="price-off">-{eff}%</span>
      <span className="price-strike">{formatPriceJpy(item.priceJpy)}</span>
      <span className={cls}>{now}</span>
    </span>
  );
}

/* ===== ホーム: 「注目＆おすすめ」カルーセル(Steam 型) =====
 *  - 中央: 大きなカバー(右パネルのスクショにホバーすると差し替わる)
 *  - 右: 作品名 / 評価 / スクショ 2×2 の情報パネル
 *  - 左右端: 前後の作品が少し覗く(クリックで送り)
 */
function HeroCarousel({
  items,
  purchased,
  onOpen,
}: {
  items: FeaturedItem[];
  purchased: Set<string>;
  onOpen: (item: StoreItem) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [hoverShot, setHoverShot] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  // 7 秒ごとに自動送り。手動操作でタイマーを巻き直す。
  const restart = useCallback(() => {
    window.clearInterval(timer.current);
    if (items.length <= 1) return;
    timer.current = window.setInterval(() => {
      setIdx((i) => (i + 1) % items.length);
      setHoverShot(null);
    }, 7000);
  }, [items.length]);

  useEffect(() => {
    restart();
    return () => window.clearInterval(timer.current);
  }, [restart]);

  if (items.length === 0) return null;
  const n = items.length;
  const cur = items[Math.min(idx, n - 1)];
  const prev = items[(idx - 1 + n) % n];
  const next = items[(idx + 1) % n];

  function select(i: number) {
    setIdx(((i % n) + n) % n);
    setHoverShot(null);
    restart();
  }

  const mainImg = hoverShot ?? cur.coverUrl;

  return (
    <section className="feat">
      <SecHead icon={<Sparkles size={16} />} tone="coral" title="注目＆おすすめ" />
      <div className="feat-row">
        {/* 左ピーク(前の作品) */}
        {n > 1 && (
          <button
            className="feat-peek left"
            onClick={() => select(idx - 1)}
            title={prev.title}
            aria-label="前へ"
          >
            {prev.coverUrl && <img src={prev.coverUrl} alt="" loading="lazy" />}
            <span className="feat-peek-arrow">‹</span>
          </button>
        )}

        {/* 中央 + 右パネル(ひとつのカード) */}
        <div className="feat-card" onClick={() => onOpen(cur)} role="button">
          <div className="feat-main">
            {mainImg ? (
              <img key={mainImg} src={mainImg} alt={cur.title} />
            ) : (
              <span className="store-noimg">No Image</span>
            )}
            <div className="hero-overlay">
              <div className="hero-meta">
                <span className="hero-creator">
                  {cur.creator.avatarUrl && (
                    <img src={cur.creator.avatarUrl} alt="" />
                  )}
                  {cur.creator.displayName || "（無名）"}
                </span>
                <span className="hero-price">
                  <PriceTag item={cur} size="lg" />
                </span>
                {purchased.has(cur.id) && (
                  <span className="store-owned-chip static">✓ 購入済み</span>
                )}
              </div>
            </div>
          </div>

          <aside className="feat-info">
            <h4 className="feat-title">{cur.title}</h4>
            <p className="feat-revline">
              {cur.review && cur.review.total > 0 ? (
                <>
                  <span className={`feat-revlabel ${reviewTone(cur.review.label)}`}>
                    {cur.review.label}
                  </span>
                  <span className="muted">
                    （{cur.review.total.toLocaleString("ja-JP")}件のレビュー）
                  </span>
                </>
              ) : (
                <span className="muted">レビュー募集中</span>
              )}
            </p>
            <div className="feat-shots">
              {(cur.screens.length > 0
                ? cur.screens
                : cur.coverUrl
                  ? [cur.coverUrl]
                  : []
              ).map((url) => (
                <span
                  key={url}
                  className="feat-shot"
                  onMouseEnter={() => setHoverShot(url)}
                  onMouseLeave={() => setHoverShot(null)}
                >
                  <img src={url} alt="" loading="lazy" />
                </span>
              ))}
            </div>
            <p className="feat-tagline muted">
              {PRODUCT_TYPE_LABEL[cur.productType] ?? cur.productType}
              {cur.systemLabel ? ` ・ ${cur.systemLabel}` : ""}
            </p>
          </aside>
        </div>

        {/* 右ピーク(次の作品) */}
        {n > 1 && (
          <button
            className="feat-peek right"
            onClick={() => select(idx + 1)}
            title={next.title}
            aria-label="次へ"
          >
            {next.coverUrl && <img src={next.coverUrl} alt="" loading="lazy" />}
            <span className="feat-peek-arrow">›</span>
          </button>
        )}
      </div>

      {/* ドットインジケータ */}
      {n > 1 && (
        <div className="feat-dots">
          {items.map((it, i) => (
            <button
              key={it.id}
              className={`feat-dot ${i === idx ? "active" : ""}`}
              onClick={() => select(i)}
              aria-label={it.title}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/* ===== カバー画像(ホバーでスクリーンショットを巡回) ===== */

function HoverCover({
  item,
  owned,
  className,
}: {
  item: StoreItem;
  owned: boolean;
  className: string;
}) {
  // スクショは初ホバー時に遅延取得してキャッシュ。
  const [shots, setShots] = useState<string[] | null>(null);
  const [hover, setHover] = useState(false);
  const [idx, setIdx] = useState(0);

  function enter() {
    setHover(true);
    if (shots === null) {
      fetchScreenshotUrls(item.id)
        .then(setShots)
        .catch(() => setShots([]));
    }
  }
  function leave() {
    setHover(false);
    setIdx(0);
  }

  const cycling = hover && !!shots && shots.length > 0;
  useEffect(() => {
    if (!cycling) return;
    const t = window.setInterval(() => setIdx((i) => i + 1), 900);
    return () => window.clearInterval(t);
  }, [cycling]);

  const src = cycling ? shots![idx % shots!.length] : item.coverUrl;

  return (
    <span
      className={className}
      onMouseEnter={enter}
      onMouseLeave={leave}
    >
      {src ? (
        <img key={src} src={src} alt="" loading="lazy" />
      ) : (
        <span className="store-noimg">No Image</span>
      )}
      {owned && <span className="store-owned-chip">✓ 購入済み</span>}
      {cycling && shots!.length > 1 && (
        <span className="hov-dots">
          {shots!.map((_, i) => (
            <i key={i} className={i === idx % shots!.length ? "on" : ""} />
          ))}
        </span>
      )}
    </span>
  );
}

/* ===== ホーム: 横スクロールのストリップ ===== */

function Strip({
  icon,
  tone,
  title,
  items,
  purchased,
  onOpen,
  onMore,
}: {
  icon: ReactNode;
  tone: SecTone;
  title: string;
  items: StoreItem[];
  purchased: Set<string>;
  onOpen: (item: StoreItem) => void;
  onMore?: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <section className="strip">
      <SecHead
        icon={icon}
        tone={tone}
        title={title}
        action={onMore ? { label: "すべて見る", onClick: onMore } : undefined}
      />
      <div className="strip-row">
        {items.map((it) => (
          <button
            key={it.id}
            className="strip-card"
            onClick={() => onOpen(it)}
            title={it.title}
          >
            <HoverCover
              item={it}
              owned={purchased.has(it.id)}
              className="strip-cover"
            />
            <span className="strip-title">{it.title}</span>
            <span className="strip-foot">
              <PriceTag item={it} />
              <ReviewBadge review={it.review} />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ===== ホーム: 人気クリエイター TOP 3(Web ホームと同じデザイン) ===== */

const RANK_LABEL: Record<number, string> = { 1: "1", 2: "2", 3: "3" };

function TopCreators({
  entries,
  onOpenCreator,
  onOpenProduct,
  onSeeAll,
}: {
  entries: TopCreatorEntry[];
  onOpenCreator: (c: { id: string; displayName: string }) => void;
  onOpenProduct: (it: StoreItem) => void;
  onSeeAll: () => void;
}) {
  return (
    <section className="topcre">
      <SecHead
        icon={<Trophy size={16} />}
        tone="gold"
        title="人気クリエイター"
        sub={`購入数の多いクリエイター TOP ${entries.length}`}
        action={{ label: "すべて見る", onClick: onSeeAll }}
      />
      <div className="topcre-grid">
        {entries.map((e) => {
          const name = e.creator.displayName || "（無名）";
          return (
            <div key={e.creator.id} className={`topcre-card rank-${e.rank}`}>
              <button
                className="topcre-main"
                onClick={() =>
                  onOpenCreator({ id: e.creator.id, displayName: name })
                }
                title={`${name} の作品を見る`}
              >
                <span className="topcre-av-wrap">
                  {e.creator.avatarUrl ? (
                    <img
                      className="topcre-av"
                      src={e.creator.avatarUrl}
                      alt=""
                      loading="lazy"
                    />
                  ) : (
                    <span className="topcre-av ph">
                      <UserIcon size={22} />
                    </span>
                  )}
                  <span className="topcre-rank">{RANK_LABEL[e.rank] ?? e.rank}</span>
                </span>
                <span className="topcre-meta">
                  <b className="topcre-name">{name}</b>
                  <span className="topcre-sales">累計購入 {e.totalSales} 件</span>
                </span>
              </button>

              <button
                className="topcre-best"
                onClick={() => onOpenProduct(e.topProduct)}
                title={e.topProduct.title}
              >
                <span className="topcre-best-label">ベストセラー作品</span>
                <span className="topcre-best-row">
                  <span className="topcre-best-cover">
                    {e.topProduct.coverUrl ? (
                      <img src={e.topProduct.coverUrl} alt="" loading="lazy" />
                    ) : (
                      <span className="store-noimg">No Image</span>
                    )}
                  </span>
                  <span className="topcre-best-info">
                    <span className="topcre-best-title">
                      {e.topProduct.title}
                    </span>
                    <span className="topcre-best-foot">
                      <span className="work-badge">
                        {PRODUCT_TYPE_LABEL[e.topProduct.productType] ??
                          e.topProduct.productType}
                      </span>
                      <span className="store-price small">
                        {formatPriceJpy(e.topProduct.priceJpy)}
                      </span>
                    </span>
                  </span>
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ===== 本体 ===== */

type ViewMode = "home" | "browse" | "creators";

export function StorePanel({
  initialCategory = null,
  homeSignal = 0,
  onGoLibrary,
}: {
  initialCategory?: RemoteProductType | null;
  /** インクリメントされるとホーム画面へ巻き戻す(ロゴ / ストアタブ)。 */
  homeSignal?: number;
  /** 「購入タブで開く」押下時(App がタブを切替える)。 */
  onGoLibrary?: () => void;
}) {
  const { session } = useAuth();

  // ジャンル指定で開かれたら最初から一覧、それ以外はホーム。
  const [view, setView] = useState<ViewMode>(initialCategory ? "browse" : "home");

  // ホーム。
  const [home, setHome] = useState<StoreHome | null>(null);
  const [homeLoading, setHomeLoading] = useState(false);

  // クリエイター一覧(「クリエイターを探す」)。
  const [creators, setCreators] = useState<StoreCreator[] | null>(null);
  const [creatorsLoading, setCreatorsLoading] = useState(false);

  // 一覧(ブラウズ)の条件。
  const [category, setCategory] = useState<RemoteProductType | null>(
    initialCategory,
  );
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [creatorFilter, setCreatorFilter] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [sort, setSort] = useState<StoreSort>("published");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<StoreItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [purchased, setPurchased] = useState<Set<string>>(new Set());

  // 詳細(どのビューの上にも被せられる)。
  const [detail, setDetail] = useState<StoreDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [mainImage, setMainImage] = useState<string | null>(null);

  // 詳細でのレビュー投稿(購入済み + ログイン時のみ)。
  const [reviewStars, setReviewStars] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [hasMyReview, setHasMyReview] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewMsg, setReviewMsg] = useState<string | null>(null);

  // 詳細を開いて購入済みなら、自分のレビューを読み込んで初期値に。
  useEffect(() => {
    const uid = session?.user.id;
    setReviewMsg(null);
    if (!detail || !uid || !purchased.has(detail.id)) {
      setReviewStars(0);
      setReviewComment("");
      setHasMyReview(false);
      return;
    }
    let alive = true;
    void fetchMyReview(detail.id, uid).then((mr) => {
      if (!alive) return;
      setReviewStars(mr?.stars ?? 0);
      setReviewComment(mr?.comment ?? "");
      setHasMyReview(Boolean(mr));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.id, session?.user.id, purchased]);

  async function submitMyReview() {
    const uid = session?.user.id;
    if (!uid || !detail) return;
    if (reviewStars < 1) {
      setReviewMsg("星をタップして評価を選んでください");
      return;
    }
    setReviewBusy(true);
    setReviewMsg(null);
    try {
      await submitReview(detail.id, uid, reviewStars, reviewComment);
      setHasMyReview(true);
      const d = await fetchStoreDetail(detail.id);
      if (d) setDetail(d);
      setReviewMsg("レビューを投稿しました。ありがとうございます！");
    } catch (e) {
      setReviewMsg(e instanceof Error ? e.message : "投稿に失敗しました");
    } finally {
      setReviewBusy(false);
    }
  }

  async function removeMyReview() {
    const uid = session?.user.id;
    if (!uid || !detail) return;
    setReviewBusy(true);
    setReviewMsg(null);
    try {
      await deleteMyReview(detail.id, uid);
      setReviewStars(0);
      setReviewComment("");
      setHasMyReview(false);
      const d = await fetchStoreDetail(detail.id);
      if (d) setDetail(d);
    } catch (e) {
      setReviewMsg(e instanceof Error ? e.message : "削除に失敗しました");
    } finally {
      setReviewBusy(false);
    }
  }

  // ロゴ / ストアタブのクリックでホームへ巻き戻す。
  useEffect(() => {
    if (homeSignal > 0) {
      setDetail(null);
      setView("home");
    }
  }, [homeSignal]);

  // ホームの読み込み(初回のみ。再訪はキャッシュ)。
  useEffect(() => {
    if (view !== "home" || home || homeLoading) return;
    setHomeLoading(true);
    setError(null);
    fetchStoreHome()
      .then(setHome)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setHomeLoading(false));
  }, [view, home, homeLoading]);

  // クリエイター一覧の読み込み(初回のみ)。
  useEffect(() => {
    if (view !== "creators" || creators || creatorsLoading) return;
    setCreatorsLoading(true);
    setError(null);
    fetchStoreCreators()
      .then(setCreators)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setCreatorsLoading(false));
  }, [view, creators, creatorsLoading]);

  // 一覧の読み込み。
  const loadBrowse = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchStore({
        category,
        q,
        creatorId: creatorFilter?.id ?? null,
        sort,
        page,
      });
      setItems(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [category, q, creatorFilter, sort, page]);

  useEffect(() => {
    if (view === "browse") void loadBrowse();
  }, [view, loadBrowse]);

  // 購入済み集合(ログイン中のみ)。
  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) {
      setPurchased(new Set());
      return;
    }
    void fetchMyPurchasedIds(userId).then(setPurchased).catch(() => {});
  }, [session?.user.id]);

  async function openDetail(item: StoreItem) {
    setDetailLoading(true);
    setError(null);
    try {
      const d = await fetchStoreDetail(item.id);
      if (!d) {
        setError("この作品は現在公開されていません");
        return;
      }
      setDetail(d);
      setMainImage(d.coverUrl ?? d.screenshotUrls[0] ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDetailLoading(false);
    }
  }

  function browseWith(opts: {
    category?: RemoteProductType | null;
    q?: string;
    creator?: { id: string; name: string } | null;
    sort?: StoreSort;
  }) {
    setDetail(null);
    setCategory(opts.category ?? null);
    setQ(opts.q ?? "");
    setQInput(opts.q ?? "");
    setCreatorFilter(opts.creator ?? null);
    if (opts.sort) setSort(opts.sort);
    setPage(1);
    setView("browse");
  }

  function search() {
    browseWith({ category, q: qInput, creator: creatorFilter, sort });
  }

  if (!supabaseConfigured) {
    return (
      <div className="store">
        <p className="muted" style={{ padding: 24 }}>
          ストアを使うには接続設定(VITE_SUPABASE_URL / ANON_KEY)が必要です。
        </p>
      </div>
    );
  }

  /* ===== 詳細ビュー ===== */
  if (detail) {
    const isPurchased = purchased.has(detail.id);
    const gallery = [
      ...(detail.coverUrl ? [detail.coverUrl] : []),
      ...detail.screenshotUrls,
    ];
    return (
      <div className="store">
        <div className="store-head">
          <button className="btn mini" onClick={() => setDetail(null)}>
            ← ストアに戻る
          </button>
          <h2 className="store-dtitle">{detail.title}</h2>
        </div>

        <div className="store-body">
          <div className="store-detail">
            {/* 左: ギャラリー */}
            <div className="store-gallery">
              <div className="store-gmain">
                {mainImage ? (
                  <img src={mainImage} alt={detail.title} />
                ) : (
                  <span className="store-noimg">No Image</span>
                )}
              </div>
              {gallery.length > 1 && (
                <div className="store-gthumbs">
                  {gallery.map((url) => (
                    <button
                      key={url}
                      className={`store-gthumb ${mainImage === url ? "active" : ""}`}
                      onClick={() => setMainImage(url)}
                    >
                      <img src={url} alt="" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}

              <h3 className="store-sec">作品について</h3>
              <p className="store-desc">{detail.description || "（説明なし）"}</p>

              <h3 className="store-sec">
                レビュー <ReviewBadge review={detail.review} />
              </h3>

              {/* 投稿フォーム(購入済み + ログイン時のみ。押し付けない控えめ導線)*/}
              {session && isPurchased && (
                <div className="rev-editor">
                  <p className="rev-editor-label">
                    {hasMyReview
                      ? "あなたのレビューを編集"
                      : "プレイした感想を星で評価"}
                  </p>
                  <div className="rev-editor-stars">
                    <StarsInput value={reviewStars} onChange={setReviewStars} />
                    <span className="muted" style={{ fontSize: 12 }}>
                      {reviewStars > 0 ? STAR_WORD[reviewStars] : "星をタップ"}
                    </span>
                  </div>
                  <textarea
                    className="input rev-editor-text"
                    rows={2}
                    maxLength={2000}
                    placeholder="コメント(任意、最大 2000 文字)"
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                  />
                  <div className="rev-editor-actions">
                    <button
                      className="btn btn-primary mini"
                      disabled={reviewBusy || reviewStars < 1}
                      onClick={() => void submitMyReview()}
                    >
                      {reviewBusy ? "送信中…" : hasMyReview ? "更新する" : "投稿する"}
                    </button>
                    {hasMyReview && (
                      <button
                        className="btn mini"
                        disabled={reviewBusy}
                        onClick={() => void removeMyReview()}
                        title="レビューを削除"
                      >
                        <Trash2 size={14} /> 削除
                      </button>
                    )}
                    {reviewMsg && (
                      <span className="muted" style={{ fontSize: 11.5 }}>
                        {reviewMsg}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {detail.reviews.length === 0 ? (
                <p className="muted" style={{ fontSize: 12.5 }}>
                  まだレビューはありません。購入してプレイした人が、最初の星評価を付けられます。
                </p>
              ) : (
                <div className="store-reviews">
                  {detail.reviews.map((r) => (
                    <div key={r.id} className="store-review">
                      <div className="store-review-head">
                        <StarsDisplay value={r.stars} size={13} />
                        <b>{r.user.displayName || "ユーザー"}</b>
                        <span className="muted" style={{ fontSize: 11 }}>
                          {new Date(r.createdAt).toLocaleDateString("ja-JP")}
                        </span>
                        {r.helpfulCount > 0 && (
                          <span className="muted" style={{ fontSize: 11 }}>
                            ・{r.helpfulCount}人が役に立ったと評価
                          </span>
                        )}
                      </div>
                      {r.comment && <p className="store-review-body">{r.comment}</p>}
                      {r.reply && (
                        <div className="store-reply">
                          <b>↳ {r.reply.creatorName || "作者"}（作者）:</b>{" "}
                          {r.reply.body}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 右: 購入 / メタ */}
            <aside className="store-side">
              <div className="store-buybox">
                <span className="store-price">
                  <PriceTag item={detail} size="lg" />
                </span>
                <ReviewBadge review={detail.review} />
                {isPurchased ? (
                  <>
                    <span className="work-badge done store-owned">✓ 購入済み</span>
                    <button
                      className="btn btn-primary ibtn"
                      onClick={() => onGoLibrary?.()}
                    >
                      <LibraryBig size={15} /> ライブラリで開く
                    </button>
                  </>
                ) : !session ? (
                  <>
                    <button
                      className="btn btn-primary ibtn"
                      onClick={() =>
                        requireLogin(
                          detail.priceJpy === 0
                            ? "ダウンロードにはログインが必要です。"
                            : "購入にはログインが必要です。",
                        )
                      }
                    >
                      <ShoppingCart size={15} /> ログインして
                      {detail.priceJpy === 0 ? "入手" : "購入"}
                    </button>
                    <p className="store-buynote">
                      ストアの閲覧はログイン無しで自由にできます。購入や
                      ダウンロードにはアカウントが必要です。
                    </p>
                  </>
                ) : (
                  <>
                    <button
                      className="btn btn-primary ibtn"
                      onClick={() => void openUrl(webProductUrl(detail.slug))}
                    >
                      <ShoppingCart size={15} />{" "}
                      {detail.priceJpy === 0
                        ? "無料で入手"
                        : "Webストアで購入"}
                    </button>
                    <p className="store-buynote">
                      {detail.priceJpy === 0
                        ? "ブラウザでワンクリックでライブラリに追加します。"
                        : "決済はブラウザ(Web版)で行います。購入後、アプリの「購入」タブに反映されます。"}
                    </p>
                  </>
                )}
              </div>

              <div className="store-meta">
                <div className="store-creator">
                  {detail.creator.avatarUrl ? (
                    <img src={detail.creator.avatarUrl} alt="" />
                  ) : (
                    <span className="store-avatar-ph">👤</span>
                  )}
                  <div>
                    <button
                      className="store-creator-link"
                      title="このクリエイターの作品を見る"
                      onClick={() =>
                        browseWith({
                          creator: {
                            id: detail.creator.id,
                            name: detail.creator.displayName || "（無名）",
                          },
                        })
                      }
                    >
                      {detail.creator.displayName || "（無名）"}
                    </button>
                    {detail.creatorBio && (
                      <p className="muted store-bio">{detail.creatorBio}</p>
                    )}
                  </div>
                </div>

                <dl className="store-dl">
                  <dt>種別</dt>
                  <dd>{PRODUCT_TYPE_LABEL[detail.productType] ?? detail.productType}</dd>
                  <dt>形式</dt>
                  <dd>{FILE_FORMAT_LABEL[detail.fileFormat] ?? detail.fileFormat}</dd>
                  {detail.systemLabel && (
                    <>
                      <dt>システム</dt>
                      <dd>{detail.systemLabel}</dd>
                    </>
                  )}
                  {detail.players && (
                    <>
                      <dt>人数</dt>
                      <dd>{detail.players}</dd>
                    </>
                  )}
                  {detail.playtime && (
                    <>
                      <dt>時間</dt>
                      <dd>{detail.playtime}</dd>
                    </>
                  )}
                  {detail.recommendedSkills && (
                    <>
                      <dt>推奨技能</dt>
                      <dd>{detail.recommendedSkills}</dd>
                    </>
                  )}
                  <dt>商用利用</dt>
                  <dd>{detail.allowCommercial ? "可" : "不可"}</dd>
                  <dt>再配布</dt>
                  <dd>{detail.allowRedistribution ? "可" : "不可"}</dd>
                  <dt>公開日</dt>
                  <dd>{new Date(detail.publishedAt).toLocaleDateString("ja-JP")}</dd>
                </dl>

                {detail.tags.length > 0 && (
                  <div className="store-tags">
                    {detail.tags.map((t) => (
                      <button
                        key={t}
                        className="store-tag"
                        title={`タグ「${t}」で検索`}
                        onClick={() => browseWith({ q: t })}
                      >
                        #{t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>
    );
  }

  /* ===== 共通ヘッダー(検索) ===== */
  const header = (
    <div className="store-head">
      <h2
        className="store-title clickable"
        onClick={() => {
          setView("home");
          setDetail(null);
        }}
        title="ストアのホームへ"
      >
        <Store size={19} /> ストア
      </h2>
      <div className="store-search">
        <input
          className="input"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="タイトル / 作者 / タグで検索"
        />
        <button className="btn mini ibtn" onClick={search}>
          <Search size={14} /> 検索
        </button>
      </div>
      {view === "browse" && (
        <select
          className="input store-sort"
          value={sort}
          onChange={(e) => {
            setSort(e.target.value as StoreSort);
            setPage(1);
          }}
        >
          <option value="published">新着順</option>
          <option value="rating">好評順</option>
        </select>
      )}
    </div>
  );

  /* ===== クリエイター一覧ビュー ===== */
  if (view === "creators") {
    return (
      <div className="store">
        {header}
        <div className="store-cats">
          <button className="store-cat" onClick={() => setView("home")}>
            ← ホーム
          </button>
          <span className="store-count muted">
            {creators ? `${creators.length} 人` : ""}
          </span>
        </div>

        {error && (
          <p className="tag fail" style={{ margin: "4px 16px" }}>
            {error}
          </p>
        )}

        <div className="store-body">
          <div className="creators-head">
            <h3 className="ibtn">
              <Users size={17} /> クリエイターを探す
            </h3>
            <p className="muted">
              公開作品を持つクリエイターの一覧。「人」から作品に出会う入口。
            </p>
          </div>
          {creatorsLoading && !creators && <SkelGrid count={6} />}
          {creators && creators.length === 0 && (
            <EmptyState
              title="クリエイターはまだいません"
              hint="公開作品を持つクリエイターがここに並びます。"
            />
          )}
          {creators && creators.length > 0 && (
            <div className="creators-grid">
              {creators.map((c) => (
                <button
                  key={c.id}
                  className="creator-card"
                  onClick={() =>
                    browseWith({
                      creator: { id: c.id, name: c.displayName || "（無名）" },
                    })
                  }
                  title={`${c.displayName || "（無名）"} の作品を見る`}
                >
                  {c.avatarUrl ? (
                    <img className="creator-avatar" src={c.avatarUrl} alt="" />
                  ) : (
                    <span className="store-avatar-ph">👤</span>
                  )}
                  <span className="creator-meta">
                    <b className="creator-name">{c.displayName || "（無名）"}</b>
                    {c.bio && <span className="creator-bio muted">{c.bio}</span>}
                    <span className="creator-count">作品 {c.workCount} 件</span>
                  </span>
                  <span className="catcard-arrow">→</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ===== ホームビュー(Steam フロントページ) ===== */
  if (view === "home") {
    return (
      <div className="store">
        {header}
        {/* ジャンルナビ */}
        <div className="store-cats">
          {CATEGORIES.filter((c) => c.key).map((c) => (
            <button
              key={c.label}
              className="store-cat ibtn"
              onClick={() => browseWith({ category: c.key })}
            >
              {c.key && CATEGORY_ICON[c.key]}
              {c.label}
            </button>
          ))}
          <button className="store-cat" onClick={() => browseWith({})}>
            すべての作品 →
          </button>
        </div>

        {error && (
          <p className="tag fail" style={{ margin: "4px 16px" }}>
            {error}
          </p>
        )}

        <div className="store-body">
          {homeLoading && !home && <SkelStoreHome />}

          {home && home.featured.length === 0 && (
            <EmptyState
              title="まだ公開作品がありません"
              hint="クリエイターの最初の作品が並ぶのをお楽しみに。"
            />
          )}

          {home && home.featured.length > 0 && (
            <div className="shome" aria-busy={detailLoading}>
              {/* 大型バナー(Steam のフェス枠相当。今はブランド常設) */}
              <div className="sbanner" onClick={() => browseWith({})}>
                <span className="sbanner-dice" aria-hidden>
                  🎲
                </span>
                <div className="sbanner-copy">
                  <strong className="sbanner-title">パラDa-iCE ストア</strong>
                  <span className="sbanner-sub">
                    シナリオ・マップ・素材がここに。買ったらそのまま卓へ。
                  </span>
                </div>
                <span className="sbanner-cta">すべての作品を見る →</span>
              </div>

              <HeroCarousel
                items={home.featured}
                purchased={purchased}
                onOpen={(it) => void openDetail(it)}
              />

              {/* カテゴリで探す(Web ホームと同じデザイン) */}
              <section className="catsec">
                <SecHead
                  icon={<LayoutGrid size={16} />}
                  tone="sky"
                  title="カテゴリで探す"
                  sub="ジャンルから作品を絞り込んで探せます"
                />

                {/* 目玉: フルパッケージ(完成品ゲーム一式) */}
                <button
                  className="catfeat"
                  onClick={() => browseWith({ category: "full_package" })}
                >
                  <span className="catfeat-ic">
                    <Boxes size={24} />
                  </span>
                  <span className="catfeat-copy">
                    <span className="catfeat-titlerow">
                      <span className="catfeat-badge">目玉</span>
                      <span className="catfeat-title">フルパッケージ</span>
                    </span>
                    <span className="catfeat-sub muted">
                      買ってすぐ遊べる、完成品のゲーム一式（システム＋シナリオ）。ダウンロードして取り込むだけ。
                    </span>
                  </span>
                  <span className="catfeat-arrow">→</span>
                </button>

                <div className="catcards">
                  {CAT_CARDS.map((c) => (
                    <button
                      key={c.key}
                      className={`catcard tone-${c.tone}`}
                      onClick={() => browseWith({ category: c.key })}
                    >
                      <span className="catcard-icon">{c.icon}</span>
                      <span className="catcard-label">
                        {c.label}
                        <span className="catcard-arrow">→</span>
                      </span>
                      <span className="catcard-sub">{c.sub}</span>
                    </button>
                  ))}
                </div>
              </section>

              {/* 人気クリエイター TOP 3(Web ホームと同じデザイン) */}
              {home.topCreators.length > 0 && (
                <TopCreators
                  entries={home.topCreators}
                  onOpenCreator={(c) =>
                    browseWith({ creator: { id: c.id, name: c.displayName } })
                  }
                  onOpenProduct={(it) => void openDetail(it)}
                  onSeeAll={() => {
                    setDetail(null);
                    setView("creators");
                  }}
                />
              )}

              {/* クリエイターを探す */}
              <button
                className="creators-banner"
                onClick={() => {
                  setDetail(null);
                  setView("creators");
                }}
              >
                <span className="creators-banner-icon">
                  <Users size={20} />
                </span>
                <span className="creators-banner-copy">
                  <strong>クリエイターを探す</strong>
                  <span className="muted">
                    公開作品を持つクリエイターを一覧表示。「人」から作品に出会う入口。
                  </span>
                </span>
                <span className="strip-more">すべて見る →</span>
              </button>

              <Strip
                icon={<Flame size={16} />}
                tone="coral"
                title="急上昇"
                items={home.trending}
                purchased={purchased}
                onOpen={(it) => void openDetail(it)}
              />
              <Strip
                icon={<Sparkles size={16} />}
                tone="sky"
                title="新着"
                items={home.recent}
                purchased={purchased}
                onOpen={(it) => void openDetail(it)}
                onMore={() => browseWith({ sort: "published" })}
              />
              <Strip
                icon={<ThumbsUp size={16} />}
                tone="mint"
                title="好評な作品"
                items={home.topRated}
                purchased={purchased}
                onOpen={(it) => void openDetail(it)}
                onMore={() => browseWith({ sort: "rating" })}
              />
              {home.byCategory.map(({ category: cat, items: catItems }) => (
                <Strip
                  key={cat}
                  icon={CATEGORY_ICON[cat]}
                  tone={CAT_TONE[cat]}
                  title={PRODUCT_TYPE_LABEL[cat] ?? cat}
                  items={catItems}
                  purchased={purchased}
                  onOpen={(it) => void openDetail(it)}
                  onMore={() => browseWith({ category: cat })}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ===== 一覧(ブラウズ)ビュー ===== */
  return (
    <div className="store">
      {header}
      <div className="store-cats">
        <button className="store-cat" onClick={() => setView("home")}>
          ← ホーム
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.label}
            className={`store-cat ${category === c.key ? "active" : ""}`}
            onClick={() => {
              setCategory(c.key);
              setPage(1);
            }}
          >
            {c.label}
          </button>
        ))}
        {q && (
          <span className="store-qchip">
            「{q}」の検索結果
            <button
              onClick={() => {
                setQ("");
                setQInput("");
                setPage(1);
              }}
              title="検索を解除"
            >
              ×
            </button>
          </span>
        )}
        {creatorFilter && (
          <span className="store-qchip">
            👤 {creatorFilter.name} の作品
            <button
              onClick={() => {
                setCreatorFilter(null);
                setPage(1);
              }}
              title="作者の絞り込みを解除"
            >
              ×
            </button>
          </span>
        )}
        <span className="store-count muted">{items ? `${total} 件` : ""}</span>
      </div>

      {error && (
        <p className="tag fail" style={{ margin: "4px 16px" }}>
          {error}
        </p>
      )}

      <div className="store-body">
        {loading && items === null && <SkelGrid count={10} />}

        {items && items.length === 0 && (
          <EmptyState
            title="該当する作品がありません"
            hint="検索条件やカテゴリを変えて探してみてください。"
            action={{ label: "条件をクリア", onClick: () => browseWith({}) }}
          />
        )}

        {items && items.length > 0 && (
          <div className={`store-grid ${loading ? "dim" : ""}`}>
            {items.map((it) => (
              <button
                key={it.id}
                className="store-card"
                onClick={() => void openDetail(it)}
                disabled={detailLoading}
                title={it.title}
              >
                <HoverCover
                  item={it}
                  owned={purchased.has(it.id)}
                  className="store-cover"
                />
                <div className="store-card-body">
                  <span className="store-card-title">{it.title}</span>
                  <span className="store-card-creator">
                    {it.creator.avatarUrl ? (
                      <img src={it.creator.avatarUrl} alt="" loading="lazy" />
                    ) : (
                      <span className="store-avatar-ph small">👤</span>
                    )}
                    {it.creator.displayName || "（無名）"}
                  </span>
                  <span className="store-card-badges">
                    <span className="work-badge">
                      {PRODUCT_TYPE_LABEL[it.productType] ?? it.productType}
                    </span>
                    {it.systemLabel && (
                      <span className="work-badge">{it.systemLabel}</span>
                    )}
                  </span>
                  <span className="store-card-foot">
                    <PriceTag item={it} />
                    <ReviewBadge review={it.review} />
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {items && totalPages > 1 && (
          <div className="store-pager">
            <button
              className="btn mini"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              ← 前へ
            </button>
            <span className="muted" style={{ fontSize: 12 }}>
              {page} / {totalPages}
            </span>
            <button
              className="btn mini"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              次へ →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

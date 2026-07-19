import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Store,
  Search,
  Heart,
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
  UserPlus,
  UserCheck,
  Play,
  Coins,
} from "lucide-react";
import { openExternalUrl as openUrl, WEB_BASE } from "./platform";
import { toast } from "./Toasts";
import { requireLogin } from "./LoginGate";
import { useWishlist, toggleWish } from "./wishlist";
import { useFollows, toggleFollow } from "./follow-creators";
import {
  purchaseWithGold,
  sendTip,
  refreshGold,
  useGoldBalance,
} from "./gold-remote";
import { useAuth } from "./useAuth";
import { supabase, supabaseConfigured } from "./supabase";
import { SkelGrid, SkelStoreHome } from "./Skeleton";
import { EmptyState } from "./EmptyState";
import { PRODUCT_TYPE_LABEL, FILE_FORMAT_LABEL } from "./library-remote";
import type { RemoteProductType } from "./library-remote";
import {
  fetchStore,
  fetchStoreDetail,
  fetchSimilarItems,
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
  saleEndsInLabel,
  webProductUrl,
  type StorePriceBand,
  type StoreItem,
  type StoreDetail,
  type StoreHome,
  type StoreSort,
  type StoreReviewSummary,
  type FeaturedItem,
  type StoreCreator,
  type TopCreatorEntry,
  type StoreOverview,
} from "./store-remote";

/**
 * ストア(メインペイン)。3 面構成:
 *  - ホーム: Claude Design「Re-dice App Store」準拠のフルページ
 *    (ヒーロー+信頼バー / サイコロ目カテゴリ / ランキング・セール・
 *     新着・クリエイターのカルーセル / ビルダー CTA / 絞り込みサイドバー)
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

/**
 * ブラウズのカテゴリ再編: 大分類(作品 / キャラ / 素材) → 小分類(product_type)。
 * DB の product_type は変えず UI レベルでグループ化する。マップ・BGM は「素材」。
 */
type CatGroup = {
  key: string;
  label: string;
  /** null = すべて。 */
  types: RemoteProductType[] | null;
  subs: { key: RemoteProductType; label: string }[];
};
const CAT_GROUPS: CatGroup[] = [
  { key: "all", label: "すべて", types: null, subs: [] },
  {
    key: "works",
    label: "作品",
    types: ["full_package", "scenario", "rulebook"],
    subs: [
      { key: "full_package", label: "フルパッケージ" },
      { key: "scenario", label: "シナリオ" },
      { key: "rulebook", label: "ルールブック" },
    ],
  },
  {
    key: "chara",
    label: "キャラ",
    types: ["character_art"],
    subs: [],
  },
  {
    key: "assets",
    label: "素材",
    types: ["map", "bgm_audio"],
    subs: [
      { key: "map", label: "マップ" },
      { key: "bgm_audio", label: "BGM/音声" },
    ],
  },
];

/** product_type が属する大分類のキー。 */
function groupOfType(t: RemoteProductType): string {
  return CAT_GROUPS.find((g) => g.types?.includes(t))?.key ?? "all";
}

/** ジャンルのアイコン(lucide。Web 側と同じ語彙)。 */
const CATEGORY_ICON: Record<RemoteProductType, ReactNode> = {
  full_package: <Boxes size={14} />,
  scenario: <FileText size={14} />,
  rulebook: <BookOpen size={14} />,
  character_art: <Palette size={14} />,
  map: <MapIcon size={14} />,
  bgm_audio: <Music size={14} />,
};

/* ===== デザイン共通部品(Re-dice App Store standalone 準拠) =====
 * CSS だけで描くサイコロの面。カテゴリタイル・見出しチップ・アンビエントで
 * 共用する(画像素材ゼロでブランドのダイスモチーフを使い回す)。 */

type DieFaceNum = 1 | 2 | 3 | 4 | 5 | 6;

const DIE_FACES: Record<DieFaceNum, [number, number][]> = {
  1: [[50, 50]],
  2: [
    [32, 32],
    [68, 68],
  ],
  3: [
    [28, 28],
    [50, 50],
    [72, 72],
  ],
  4: [
    [32, 32],
    [68, 32],
    [32, 68],
    [68, 68],
  ],
  5: [
    [29, 29],
    [71, 29],
    [50, 50],
    [29, 71],
    [71, 71],
  ],
  6: [
    [32, 26],
    [68, 26],
    [32, 50],
    [68, 50],
    [32, 74],
    [68, 74],
  ],
};

function DieFaceIcon({
  face,
  size,
  color,
  borderWidth = 2,
  className,
  style,
}: {
  face: DieFaceNum;
  size: number;
  color: string;
  borderWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const pip = Math.max(2, Math.round(size * 0.07));
  return (
    <span
      aria-hidden
      className={className}
      style={{
        display: "block",
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.26),
        border: `${borderWidth}px solid ${color}`,
        backgroundRepeat: "no-repeat",
        backgroundImage: DIE_FACES[face]
          .map(
            ([x, y]) =>
              `radial-gradient(circle ${pip}px at ${x}% ${y}%, ${color} 95%, transparent)`,
          )
          .join(","),
        ...style,
      }}
    />
  );
}

/** セクション見出し(デザイン準拠): 深紅ダイスチップ + 明朝タイトル + 補足 + 右端リンク。 */
function DesignHead({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="dhead">
      <span className="die-ico" aria-hidden />
      <div className="dhead-copy">
        <h3 className="dhead-title">{title}</h3>
        {sub && <p className="dhead-sub">{sub}</p>}
      </div>
      {action && (
        <button className="dhead-action" onClick={action.onClick}>
          {action.label} ›
        </button>
      )}
    </div>
  );
}

/**
 * ホーム共通の横スクロール・カルーセル(scroll-snap + 左右ボタン + ドット)。
 * ページ数は scrollWidth / clientWidth から動的に計算する。
 */
function AppCarousel({
  children,
  itemClass,
  gap = 16,
  edge = true,
}: {
  children: ReactNode[];
  /** 各アイテムの flex-basis クラス(.acar-w2 = 2枚/ビュー等)。 */
  itemClass: string;
  gap?: number;
  /** 左右ボタンをコンテナ外縁へはみ出させる。 */
  edge?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const [pageN, setPageN] = useState(0);
  const [pages, setPages] = useState(1);

  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const n = Math.max(
      1,
      Math.round((el.scrollWidth + gap) / (el.clientWidth + gap)),
    );
    setPages(n);
    setPageN((p) => Math.min(p, n - 1));
  }, [gap]);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure, children.length]);

  const goTo = useCallback(
    (p: number) => {
      const el = trackRef.current;
      if (!el) return;
      const pp = Math.max(0, Math.min(pages - 1, p));
      el.scrollTo({ left: pp * (el.clientWidth + gap), behavior: "smooth" });
    },
    [gap, pages],
  );

  const livePage = useCallback(() => {
    const el = trackRef.current;
    if (!el) return pageN;
    return Math.max(
      0,
      Math.min(pages - 1, Math.round(el.scrollLeft / (el.clientWidth + gap))),
    );
  }, [gap, pageN, pages]);

  const showNav = pages > 1;
  return (
    <div>
      <div className="acar">
        {showNav && (
          <button
            type="button"
            className={`acar-btn ${edge ? "edge" : ""}`}
            style={{ left: edge ? -16 : -4, opacity: pageN === 0 ? 0.35 : 1 }}
            aria-label="前へ"
            onClick={() => goTo(livePage() - 1)}
          >
            ‹
          </button>
        )}
        <div
          ref={trackRef}
          className="acar-track"
          style={{ gap }}
          onScroll={() => {
            window.clearTimeout(timerRef.current);
            timerRef.current = window.setTimeout(
              () => setPageN(livePage()),
              140,
            );
          }}
        >
          {children.map((c, i) => (
            <div key={i} className={`acar-item ${itemClass}`}>
              {c}
            </div>
          ))}
        </div>
        {showNav && (
          <button
            type="button"
            className={`acar-btn ${edge ? "edge" : ""}`}
            style={{
              right: edge ? -16 : -4,
              opacity: pageN >= pages - 1 ? 0.35 : 1,
            }}
            aria-label="次へ"
            onClick={() => goTo(livePage() + 1)}
          >
            ›
          </button>
        )}
      </div>
      {showNav && (
        <div className="acar-dots">
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`${i + 1}ページ目へ`}
              className="acar-dot"
              style={{
                width: i === pageN ? 22 : 8,
                background: i === pageN ? "#B02832" : "var(--acar-dot, #E3D8C2)",
              }}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
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

/** ギャラリー URL が動画か(スクショ枠に mp4/webm を挿入できる)。 */
function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm)(\?|#|$)/i.test(url);
}

/** 「今」の実効価格(割引・期間込み)。購入ボタンの文言や無料判定はこれを使う。 */
function effPriceOf(
  it: Pick<
    StoreItem,
    "priceJpy" | "discountPercent" | "discountStartsAt" | "discountEndsAt"
  >,
): number {
  return salePriceJpy(
    it.priceJpy,
    effectiveDiscountPercent(
      it.discountPercent,
      it.discountStartsAt,
      it.discountEndsAt,
    ),
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
  // 大サイズ(詳細・ヒーロー)ではセールの残り時間も出して「今買う理由」を作る。
  const endsIn = size === "lg" ? saleEndsInLabel(item.discountEndsAt) : null;
  return (
    <span className="price-sale">
      <span className="price-off">-{eff}%</span>
      <span className="price-strike">{formatPriceJpy(item.priceJpy)}</span>
      <span className={cls}>{now}</span>
      {endsIn && <span className="price-endsin">🔥 セール{endsIn}</span>}
    </span>
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

/* ===== ホーム(Re-dice App Store standalone デザイン) =====
 * Claude Design のアプリ版フルページデザインを StorePanel ホームに実装。
 * 背景アンビエント / ヒーロー(16:9 注目)+ 信頼バー / サイコロの目カテゴリ /
 * ランキング・セール・新着・クリエイターのカルーセル / ビルダー CTA /
 * 右の絞り込みサイドバー。 */

/** ホーム全面の背景アンビエント(.shome 内 absolute。% 配置で縦に分散)。 */
function StoreAmbientApp() {
  const dice: {
    pos: React.CSSProperties;
    size: number;
    crimson: boolean;
    face: DieFaceNum;
    rot: number;
    d: number;
    delay: number;
  }[] = [
    { pos: { left: "1.5%", top: "12%" }, size: 46, crimson: true, face: 5, rot: 14, d: 16, delay: 0 },
    { pos: { right: "1.5%", top: "8%" }, size: 38, crimson: false, face: 4, rot: -10, d: 18, delay: 1.2 },
    { pos: { left: "2%", top: "52%" }, size: 30, crimson: true, face: 2, rot: -18, d: 15, delay: 0.6 },
    { pos: { right: "2%", top: "60%" }, size: 42, crimson: false, face: 5, rot: 10, d: 17, delay: 2 },
    { pos: { left: "1.5%", top: "88%" }, size: 34, crimson: true, face: 3, rot: 8, d: 19, delay: 1.4 },
  ];
  const sparkClip =
    "polygon(50% 0, 60% 40%, 100% 50%, 60% 60%, 50% 100%, 40% 60%, 0 50%, 40% 40%)";
  const diamondClip = "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)";
  const shapes: {
    pos: React.CSSProperties;
    size: number;
    color: string;
    clip: string;
    d: number;
    delay: number;
  }[] = [
    { pos: { left: "4%", top: "30%" }, size: 18, color: "#C9A227", clip: sparkClip, d: 12, delay: 0 },
    { pos: { right: "4.5%", top: "36%" }, size: 14, color: "#C9A227", clip: sparkClip, d: 14, delay: 3 },
    { pos: { right: "1.5%", top: "90%" }, size: 16, color: "#C9A227", clip: sparkClip, d: 13, delay: 1.8 },
    { pos: { left: "3.5%", top: "72%" }, size: 12, color: "#D9B45C", clip: diamondClip, d: 13, delay: 1 },
    { pos: { right: "3.5%", top: "22%" }, size: 10, color: "#D9B45C", clip: diamondClip, d: 15, delay: 2.4 },
  ];
  return (
    <div aria-hidden className="samb">
      {dice.map((s, i) => (
        <DieFaceIcon
          key={`d${i}`}
          face={s.face}
          size={s.size}
          color={s.crimson ? "#B02832" : "#C9A227"}
          className="samb-item"
          style={{
            position: "absolute",
            ...s.pos,
            "--rot": `${s.rot}deg`,
            animation: `dc-float ${s.d}s ease-in-out ${s.delay}s infinite`,
          } as React.CSSProperties}
        />
      ))}
      {shapes.map((s, i) => (
        <span
          key={`s${i}`}
          className="samb-item"
          style={{
            position: "absolute",
            ...s.pos,
            width: s.size,
            height: s.size,
            background: s.color,
            clipPath: s.clip,
            animation: `dc-float ${s.d}s ease-in-out ${s.delay}s infinite, dc-twinkle ${s.d / 2}s ease-in-out ${s.delay}s infinite`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

function StoreHeroBanner({
  featured,
  total,
  onSearch,
  onQuickTag,
  onOpen,
}: {
  featured: StoreItem | null;
  /** 公開作品の実数(ヒーロー文言)。 */
  total: number;
  onSearch: (q: string) => void;
  onQuickTag: (opts: {
    category?: RemoteProductType | null;
    q?: string;
    priceBand?: StorePriceBand | null;
    saleOnly?: boolean;
  }) => void;
  onOpen: (item: StoreItem) => void;
}) {
  const [q, setQ] = useState("");
  return (
    <div className="shero">
      <div className="shero-stripes" aria-hidden />
      {/* ヒーロー下端の薄い装飾ダイス(4 の目) */}
      <DieFaceIcon
        face={4}
        size={64}
        color="rgba(243,230,200,.22)"
        className="shero-bottomdie"
        style={{ position: "absolute" }}
      />
      <div className="shero-grid">
        <div>
          <div className="shero-kicker">
            <span className="die-ico on-dark" aria-hidden />
            <span>CREATOR MARKETPLACE FOR TRPG</span>
          </div>
          <h2 className="shero-h1">
            あなたの次の物語を、
            <br />
            ここで見つける。
          </h2>
          <p className="shero-desc">
            シナリオ・ルールブック・マップ・アート・BGM。買ってすぐ卓が立てられる
            <b>
              完成品{total > 0 ? `が${total.toLocaleString("ja-JP")}点` : ""}
            </b>
            。購入した作品はライブラリからそのままPLAYへ。
          </p>
          <form
            className="shero-search"
            onSubmit={(e) => {
              e.preventDefault();
              onSearch(q);
            }}
          >
            <Search size={18} color="#B02832" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="「クトゥルフ 初心者」で探す…"
            />
            <button type="submit">検索</button>
          </form>
          <div className="shero-tags">
            <button
              type="button"
              className="shero-tag"
              onClick={() => onQuickTag({ q: "初心者におすすめ" })}
            >
              初心者におすすめ
            </button>
            <button
              type="button"
              className="shero-tag"
              onClick={() => onQuickTag({ q: "ホラー" })}
            >
              ホラー
            </button>
            <button
              type="button"
              className="shero-tag"
              onClick={() => onQuickTag({ category: "full_package" })}
            >
              フルパッケージ
            </button>
            <button
              type="button"
              className="shero-tag"
              onClick={() => onQuickTag({ saleOnly: true })}
            >
              🔥 セール中
            </button>
            <button
              type="button"
              className="shero-tag"
              onClick={() => onQuickTag({ priceBand: "free" })}
            >
              無料作品
            </button>
          </div>
        </div>

        {featured && (
          <button
            className="shero-feat shero-feat16"
            onClick={() => onOpen(featured)}
            title={featured.title}
          >
            {featured.coverUrl ? (
              <img src={featured.coverUrl} alt="" loading="lazy" />
            ) : (
              <span className="store-noimg">No Image</span>
            )}
            <span className="shero-feat-shade" aria-hidden />
            <span className="shero-feat-body">
              <span className="shero-feat-badge">今月の注目</span>
              <span>
                <strong className="shero-feat-title">{featured.title}</strong>
                <span className="shero-feat-sub">
                  {PRODUCT_TYPE_LABEL[featured.productType] ??
                    featured.productType}
                  {featured.creator.displayName
                    ? ` ・ ${featured.creator.displayName}`
                    : ""}
                </span>
              </span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

/** ヒーロー直下の信頼バー。平均評価はレビュー 0 件のとき出さない。 */
function TrustBar({ overview }: { overview: StoreOverview }) {
  const items: { num: string; label: string }[] = [
    { num: overview.total.toLocaleString("ja-JP"), label: "公開作品" },
    {
      num: overview.creatorCount.toLocaleString("ja-JP"),
      label: "活動クリエイター",
    },
    ...(overview.avgStars !== null
      ? [{ num: overview.avgStars.toFixed(1), label: "平均評価" }]
      : []),
    { num: "Stripe", label: "安全な決済" },
  ];
  return (
    <div className="strust">
      {items.map((t) => (
        <div key={t.label} className="strust-item">
          <span className="strust-num">{t.num}</span>
          <span className="strust-label">{t.label}</span>
        </div>
      ))}
    </div>
  );
}

/** カテゴリタイル(サイコロの 1〜6 の目 + 実カウント)。 */
const CAT_DICE: { type: RemoteProductType; face: DieFaceNum }[] = [
  { type: "full_package", face: 1 },
  { type: "scenario", face: 2 },
  { type: "rulebook", face: 3 },
  { type: "map", face: 4 },
  { type: "character_art", face: 5 },
  { type: "bgm_audio", face: 6 },
];

function CategoryDiceSec({
  counts,
  onPick,
}: {
  counts: Partial<Record<RemoteProductType, number>>;
  onPick: (c: RemoteProductType) => void;
}) {
  return (
    <section>
      <DesignHead
        title="カテゴリから探す"
        sub="サイコロの目で選ぶ、6つの入り口"
      />
      <div className="catdice-grid">
        {CAT_DICE.map(({ type, face }) => (
          <button
            key={type}
            className="catdice"
            onClick={() => onPick(type)}
          >
            <DieFaceIcon
              face={face}
              size={42}
              color="#B02832"
              className="catdice-die"
              style={{ backgroundColor: "var(--surface, #fff)" }}
            />
            <span className="catdice-copy">
              <span className="catdice-name">
                {PRODUCT_TYPE_LABEL[type] ?? type}
              </span>
              <span className="catdice-count">
                {(counts[type] ?? 0).toLocaleString("ja-JP")}作品
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** 人気ランキング(好評トップ6・2枚/ビュー)。順位 1=金/2=銀/3=琥珀/以降=白。 */
const RANK_BADGE: { bg: string; bd: string; fg: string }[] = [
  { bg: "#C9A227", bd: "#a8871a", fg: "#4a3a12" },
  { bg: "#e7e1d3", bd: "#d8d0bf", fg: "#6b6355" },
  { bg: "#e4b483", bd: "#d89a5f", fg: "#7a4a1f" },
];
const RANK_NEUTRAL = { bg: "#fff", bd: "#E8DCC5", fg: "#77644F" };

function RankingSec({
  items,
  onOpen,
  onMore,
}: {
  items: StoreItem[];
  onOpen: (item: StoreItem) => void;
  onMore: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <DesignHead
        title="人気ランキング"
        sub={`今週の好評トップ${items.length}`}
        action={{ label: "もっと見る", onClick: onMore }}
      />
      <AppCarousel itemClass="acar-w2">
        {items.map((it, i) => {
          const rk = RANK_BADGE[i] ?? RANK_NEUTRAL;
          return (
            <button
              key={it.id}
              className="rk6-card"
              onClick={() => onOpen(it)}
              title={it.title}
            >
              <span className="rk6-cover">
                {it.coverUrl ? (
                  <img src={it.coverUrl} alt="" loading="lazy" />
                ) : (
                  <span className="store-noimg">No Image</span>
                )}
                <span
                  className="rk6-badge"
                  style={{ background: rk.bg, borderColor: rk.bd, color: rk.fg }}
                  aria-hidden
                >
                  {i + 1}
                </span>
              </span>
              <span className="rk6-info">
                <span className="rk6-cat">
                  {PRODUCT_TYPE_LABEL[it.productType] ?? it.productType}
                </span>
                <span className="rk6-title">{it.title}</span>
                <span className="rk6-creator">
                  {it.creator.displayName || "（無名）"}
                </span>
                <span className="rk6-foot">
                  <StarsDisplay value={it.review?.avgStars ?? 0} size={12} />
                  <span className="rk6-count muted">
                    ({it.review?.total ?? 0})
                  </span>
                  <span className="rk6-price">
                    <PriceTag item={it} />
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </AppCarousel>
    </section>
  );
}

/** いちばん早く終わるセールの終了時刻 → 「残りN日 ・ M/D(曜) HH:MMまで」。 */
function nearestSaleEndLabel(items: StoreItem[]): string | null {
  const now = Date.now();
  const ends = items
    .map((p) => (p.discountEndsAt ? Date.parse(p.discountEndsAt) : NaN))
    .filter((t) => Number.isFinite(t) && t > now);
  if (ends.length === 0) return null;
  const t = Math.min(...ends);
  const d = new Date(t);
  const days = Math.ceil((t - now) / 86_400_000);
  const remain = days <= 1 ? "残り1日未満" : `残り${days}日`;
  const week = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${remain} ・ ${d.getMonth() + 1}/${d.getDate()}(${week}) ${hh}:${mm}まで`;
}

/** 期間限定セール帯(3枚/ビューのカルーセル + 終了期限チップ)。 */
function SaleStripSec({
  items,
  onOpen,
  onMore,
}: {
  items: StoreItem[];
  onOpen: (item: StoreItem) => void;
  onMore: () => void;
}) {
  if (items.length === 0) return null;
  const maxOff = Math.max(
    ...items.map((it) =>
      effectiveDiscountPercent(
        it.discountPercent,
        it.discountStartsAt,
        it.discountEndsAt,
      ),
    ),
  );
  const endLabel = nearestSaleEndLabel(items);
  return (
    <section className="ssale">
      <div className="ssale-head">
        <span className="ssale-pill">
          <Flame size={12} /> 期間限定セール
        </span>
        <span className="ssale-note">最大 {maxOff}% OFF</span>
        {endLabel && <span className="ssale-ends">{endLabel}</span>}
        <button type="button" className="ssale-more" onClick={onMore}>
          セール一覧 →
        </button>
      </div>
      <div className="ssale-body">
        <AppCarousel itemClass="acar-w3" gap={12} edge={false}>
          {items.map((it) => {
            const eff = effectiveDiscountPercent(
              it.discountPercent,
              it.discountStartsAt,
              it.discountEndsAt,
            );
            return (
              <button
                key={it.id}
                className="sale3-card"
                onClick={() => onOpen(it)}
                title={it.title}
              >
                <span className="sale3-cover">
                  {it.coverUrl ? (
                    <img src={it.coverUrl} alt="" loading="lazy" />
                  ) : (
                    <span className="store-noimg">No Image</span>
                  )}
                  <span className="sale3-off">-{eff}%</span>
                </span>
                <span className="sale3-title">{it.title}</span>
                <span className="sale3-prices">
                  <span className="sale3-strike">
                    {formatPriceJpy(it.priceJpy)}
                  </span>
                  <span className="sale3-now">
                    {formatPriceJpy(salePriceJpy(it.priceJpy, eff))}
                  </span>
                </span>
              </button>
            );
          })}
        </AppCarousel>
      </div>
    </section>
  );
}

/** 新着作品(3枚/ビュー・ウィッシュ♥・無料配布バッジ)。 */
function NewWorksSec({
  items,
  wished,
  onOpen,
  onMore,
}: {
  items: StoreItem[];
  wished: Set<string>;
  onOpen: (item: StoreItem) => void;
  onMore: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <DesignHead
        title="新着作品"
        sub="公開されたばかりの作品"
        action={{ label: "すべて見る", onClick: onMore }}
      />
      <AppCarousel itemClass="acar-w3">
        {items.map((it) => {
          const free = it.priceJpy <= 0;
          const isWished = wished.has(it.id);
          return (
            <div key={it.id} className="nw3-wrap">
              <button
                className="nw3-card"
                onClick={() => onOpen(it)}
                title={it.title}
              >
                <span className="nw3-cover">
                  {it.coverUrl ? (
                    <img src={it.coverUrl} alt="" loading="lazy" />
                  ) : (
                    <span className="store-noimg">No Image</span>
                  )}
                  {free && <span className="nw3-free">無料配布</span>}
                </span>
                <span className="nw3-body">
                  <span className="nw3-cat">
                    {PRODUCT_TYPE_LABEL[it.productType] ?? it.productType}
                    {it.systemLabel ? `・${it.systemLabel}` : ""}
                  </span>
                  <span className="nw3-title">{it.title}</span>
                  <span className="nw3-creator">
                    {it.creator.displayName || "（無名）"}
                  </span>
                  <span className="nw3-foot">
                    {it.review && it.review.total > 0 ? (
                      <span className="nw3-stars">
                        <StarsDisplay value={it.review.avgStars} size={11} />
                        <span className="muted">({it.review.total})</span>
                      </span>
                    ) : (
                      <span />
                    )}
                    <span
                      className="nw3-price"
                      style={free ? { color: "#159457" } : undefined}
                    >
                      {free ? "無料" : <PriceTag item={it} />}
                    </span>
                  </span>
                </span>
              </button>
              <button
                className={`nw3-wish ${isWished ? "on" : ""}`}
                title={
                  isWished
                    ? "ウィッシュリストから外す"
                    : "ウィッシュリストに追加"
                }
                onClick={(e) => {
                  e.stopPropagation();
                  const added = toggleWish(it.id);
                  toast(
                    added
                      ? "♥ ウィッシュリストに追加しました"
                      : "ウィッシュリストから外しました",
                  );
                }}
              >
                {isWished ? "♥" : "♡"}
              </button>
            </div>
          );
        })}
      </AppCarousel>
    </section>
  );
}

/** 人気クリエイター(2枚/ビュー)。 */
function CreatorsSec({
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
  if (entries.length === 0) return null;
  return (
    <section>
      <DesignHead
        title="人気クリエイター"
        sub="よく購入されている作り手"
        action={{ label: "クリエイター一覧", onClick: onSeeAll }}
      />
      <AppCarousel itemClass="acar-w2">
        {entries.map((e) => {
          const name = e.creator.displayName || "（無名）";
          return (
            <div key={e.creator.id} className="cre2-card">
              <button
                className="cre2-main"
                onClick={() =>
                  onOpenCreator({ id: e.creator.id, displayName: name })
                }
                title={`${name} の作品を見る`}
              >
                <span className="cre2-avwrap">
                  {e.creator.avatarUrl ? (
                    <img
                      className="cre2-av"
                      src={e.creator.avatarUrl}
                      alt=""
                      loading="lazy"
                    />
                  ) : (
                    <span className="cre2-av ph">{name.slice(0, 1)}</span>
                  )}
                  <span className="cre2-rank">{e.rank}</span>
                </span>
                <span className="cre2-meta">
                  <b className="cre2-name">{name}</b>
                  <span className="cre2-sales">
                    累計購入 {e.totalSales.toLocaleString("ja-JP")} 件
                  </span>
                </span>
              </button>
              <button
                className="cre2-best"
                onClick={() => onOpenProduct(e.topProduct)}
                title={e.topProduct.title}
              >
                <span className="cre2-bestcover">
                  {e.topProduct.coverUrl ? (
                    <img src={e.topProduct.coverUrl} alt="" loading="lazy" />
                  ) : (
                    <span className="store-noimg">No Image</span>
                  )}
                </span>
                <span className="cre2-bestinfo">
                  <span className="cre2-bestlabel">ベストセラー作品</span>
                  <span className="cre2-besttitle">{e.topProduct.title}</span>
                </span>
              </button>
            </div>
          );
        })}
      </AppCarousel>
    </section>
  );
}

/** クリエイター募集 CTA(ビルダー導線)。手数料は実態(最大80%)に合わせる。 */
function BuilderCta({ onOpenBuilder }: { onOpenBuilder?: () => void }) {
  return (
    <section className="bcta">
      <div className="bcta-stripes" aria-hidden />
      <DieFaceIcon
        face={5}
        size={58}
        color="rgba(243,230,200,.85)"
        className="bcta-die"
        style={{ backgroundColor: "rgba(255,255,255,.08)" }}
      />
      <div className="bcta-copy">
        <h3>つくった物語が、誰かの卓になる。</h3>
        <p>売上の最大80%がクリエイターに。ビルダーで作って、そのまま出品できます。</p>
      </div>
      <div className="bcta-actions">
        {onOpenBuilder && (
          <button className="bcta-primary" onClick={onOpenBuilder}>
            ビルダーを開く
          </button>
        )}
        <button
          className="bcta-ghost"
          onClick={() => void openUrl(`${WEB_BASE}/guidelines`)}
        >
          クリエイターガイド
        </button>
      </div>
    </section>
  );
}

/** 人気タグ(product_tags のクライアント集計。α 規模なので全件で十分)。 */
function usePopularTags(limit = 12): string[] {
  const [tags, setTags] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { data, error: qErr } = await supabase
          .from("product_tags")
          .select("tag")
          .limit(5000);
        if (qErr || !data || !alive) return;
        const counts = new Map<string, number>();
        for (const row of data as { tag: string | null }[]) {
          if (!row.tag) continue;
          counts.set(row.tag, (counts.get(row.tag) ?? 0) + 1);
        }
        setTags(
          Array.from(counts.entries())
            .sort((a, b) =>
              b[1] !== a[1] ? b[1] - a[1] : a[0].localeCompare(b[0]),
            )
            .slice(0, limit)
            .map(([tag]) => tag),
        );
      } catch {
        // タグが取れなくてもサイドバーは成立する。
      }
    })();
    return () => {
      alive = false;
    };
  }, [limit]);
  return tags;
}

const PRICE_BAND_OPTIONS: { value: StorePriceBand | null; label: string }[] = [
  { value: null, label: "すべて" },
  { value: "free", label: "無料" },
  { value: "u500", label: "〜500円" },
  { value: "mid", label: "500〜1,000円" },
  { value: "o1000", label: "1,000円〜" },
];

/** 右の絞り込みサイドバー。選んだ条件をブラウズビューの実フィルタへ変換して遷移。 */
function StoreFilterSidebar({
  counts,
  onApply,
}: {
  counts: Partial<Record<RemoteProductType, number>>;
  onApply: (opts: {
    category?: RemoteProductType | null;
    q?: string;
    priceBand?: StorePriceBand | null;
    saleOnly?: boolean;
  }) => void;
}) {
  const popularTags = usePopularTags(12);
  const [tagQuery, setTagQuery] = useState("");
  const [selTag, setSelTag] = useState<string | null>(null);
  const [selCat, setSelCat] = useState<RemoteProductType | null>(null);
  const [price, setPrice] = useState<StorePriceBand | null>(null);
  const [saleOnly, setSaleOnly] = useState(false);

  const shownTags = tagQuery.trim()
    ? popularTags.filter((t) =>
        t.toLowerCase().includes(tagQuery.trim().toLowerCase()),
      )
    : popularTags;
  const hasAny = selTag !== null || selCat !== null || price !== null || saleOnly;

  return (
    <div className="sfilter">
      <div className="sfilter-head">
        <span className="die-ico" aria-hidden style={{ width: 20, height: 20 }} />
        <h3>絞り込み検索</h3>
        <button
          type="button"
          className="sfilter-clear"
          onClick={() => {
            setSelTag(null);
            setSelCat(null);
            setPrice(null);
            setSaleOnly(false);
            setTagQuery("");
          }}
        >
          クリア
        </button>
      </div>

      <div className="sfilter-sec">
        <span className="sfilter-label">タグで探す</span>
        <div className="sfilter-search">
          <Search size={12} color="#B02832" />
          <input
            value={tagQuery}
            onChange={(e) => setTagQuery(e.target.value)}
            placeholder="タグ名で検索"
          />
        </div>
        {shownTags.length > 0 ? (
          <div className="sfilter-tags">
            {shownTags.map((t) => {
              const on = selTag === t;
              return (
                <button
                  key={t}
                  type="button"
                  className={`sfilter-tag ${on ? "on" : ""}`}
                  onClick={() => setSelTag(on ? null : t)}
                >
                  {t}
                </button>
              );
            })}
          </div>
        ) : (
          <span className="sfilter-empty muted">
            {popularTags.length === 0
              ? "タグはまだありません"
              : "一致するタグがありません"}
          </span>
        )}
      </div>

      <div className="sfilter-hr" />

      <div className="sfilter-sec">
        <span className="sfilter-label">ジャンル</span>
        {CAT_DICE.map(({ type }) => {
          const on = selCat === type;
          return (
            <button
              key={type}
              type="button"
              className="sfilter-row"
              onClick={() => setSelCat(on ? null : type)}
            >
              <span className={`sfilter-check ${on ? "on" : ""}`} aria-hidden>
                {on ? "✓" : ""}
              </span>
              <span className="sfilter-rowlabel">
                {PRODUCT_TYPE_LABEL[type] ?? type}
              </span>
              <span className="sfilter-rowcount muted">
                {(counts[type] ?? 0).toLocaleString("ja-JP")}
              </span>
            </button>
          );
        })}
      </div>

      <div className="sfilter-hr" />

      <div className="sfilter-sec">
        <span className="sfilter-label">価格</span>
        {PRICE_BAND_OPTIONS.map((p) => {
          const on = price === p.value;
          return (
            <button
              key={p.label}
              type="button"
              className="sfilter-row"
              onClick={() => setPrice(p.value)}
            >
              <span className={`sfilter-radio ${on ? "on" : ""}`} aria-hidden>
                <span />
              </span>
              <span className="sfilter-rowlabel">{p.label}</span>
            </button>
          );
        })}
      </div>

      <div className="sfilter-hr" />

      <button
        type="button"
        className="sfilter-row"
        onClick={() => setSaleOnly((v) => !v)}
        aria-pressed={saleOnly}
      >
        <span className={`sfilter-switch ${saleOnly ? "on" : ""}`} aria-hidden>
          <span />
        </span>
        <span className="sfilter-rowlabel">セール中のみ表示</span>
        <span className="sfilter-salechip">SALE</span>
      </button>

      <button
        type="button"
        className="sfilter-apply"
        disabled={!hasAny}
        onClick={() =>
          onApply({
            category: selCat,
            ...(selTag ? { q: selTag } : {}),
            priceBand: price,
            saleOnly,
          })
        }
      >
        この条件で絞り込む
      </button>
    </div>
  );
}

/** サイドバー下のミニカード(ライブラリ→PLAY 導線)。 */
function PlayMiniCard({
  onOpenPlay,
  onGoLibrary,
}: {
  onOpenPlay?: () => void;
  onGoLibrary?: () => void;
}) {
  return (
    <div className="sminicard">
      <DieFaceIcon
        face={5}
        size={34}
        color="#B02832"
        className="sminicard-die"
        style={{ backgroundColor: "var(--surface, #fff)" }}
      />
      <div className="sminicard-copy">
        <button
          type="button"
          className="sminicard-title"
          onClick={onGoLibrary}
          title="ライブラリを開く"
        >
          購入した作品はライブラリへ
        </button>
        <button
          type="button"
          className="sminicard-link"
          onClick={onOpenPlay}
          title="PLAY タブを開く"
        >
          PLAYですぐ卓を立てる →
        </button>
      </div>
    </div>
  );
}

/* ===== 本体 ===== */

type ViewMode = "home" | "browse" | "creators";

export function StorePanel({
  initialCategory = null,
  homeSignal = 0,
  onGoLibrary,
  onOpenBuilder,
  onOpenPlay,
}: {
  initialCategory?: RemoteProductType | null;
  /** インクリメントされるとホーム画面へ巻き戻す(ロゴ / ストアタブ)。 */
  homeSignal?: number;
  /** 「購入タブで開く」押下時(App がタブを切替える)。 */
  onGoLibrary?: () => void;
  /** ビルダー CTA 押下時(App がビルダータブへ切替える)。 */
  onOpenBuilder?: () => void;
  /** サイドバーの PLAY 導線押下時(App が PLAY タブへ切替える)。 */
  onOpenPlay?: () => void;
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

  // 一覧(ブラウズ)の条件。カテゴリは 大分類(groupKey) + 小分類(subType) の2段。
  const [groupKey, setGroupKey] = useState<string>(
    initialCategory ? groupOfType(initialCategory) : "all",
  );
  const [subType, setSubType] = useState<RemoteProductType | null>(
    initialCategory,
  );
  const cats = useMemo<RemoteProductType[] | null>(() => {
    if (subType) return [subType];
    return CAT_GROUPS.find((g) => g.key === groupKey)?.types ?? null;
  }, [groupKey, subType]);
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  // 右サイドバー: 作品名のみの絞り込み / 価格帯 / セール中 / ウィッシュのみ。
  const [titleQInput, setTitleQInput] = useState("");
  const [titleQ, setTitleQ] = useState("");
  const [priceBand, setPriceBand] = useState<StorePriceBand | null>(null);
  const [saleOnly, setSaleOnly] = useState(false);
  const [wishOnly, setWishOnly] = useState(false);
  const [followOnly, setFollowOnly] = useState(false);
  const follows = useFollows();
  const followKey = followOnly ? [...follows.keys()].sort().join(",") : "";
  const wishIds = useWishlist();
  // ウィッシュ絞り込みの再取得キー(絞り込み OFF のときはハート操作で再取得しない)。
  const wishKey = wishOnly ? [...wishIds].sort().join(",") : "";
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
  // 類似品(詳細の下部レール)。詳細を開いたときに非同期取得。
  const [similar, setSimilar] = useState<StoreItem[]>([]);
  // ゴールド購入 / スーパーサンクス。
  const goldBalance = useGoldBalance();
  const [goldBusy, setGoldBusy] = useState(false);
  // サンクスの相手(id + 表示名 + 任意で作品 id)。null = モーダル閉。
  const [tipTarget, setTipTarget] = useState<{
    id: string;
    name: string;
    productId?: string;
  } | null>(null);
  const [tipAmount, setTipAmount] = useState(100);
  const [tipMsg, setTipMsg] = useState("");
  const [tipBusy, setTipBusy] = useState(false);

  /** サンクス相手を開く(未ログインならログイン誘導)。 */
  function openTip(target: { id: string; name: string; productId?: string }) {
    if (!session) {
      requireLogin("応援にはログインが必要です。");
      return;
    }
    setTipMsg("");
    setTipTarget(target);
  }

  useEffect(() => {
    void refreshGold();
  }, []);

  /** 作品をゴールドで購入(残高不足はチャージ導線を出す)。 */
  async function buyWithGold() {
    if (!detail) return;
    setGoldBusy(true);
    try {
      const r = await purchaseWithGold(detail.id);
      if (r.ok) {
        setPurchased((s) => new Set(s).add(detail.id));
        toast("✅ ゴールドで購入しました。ライブラリで開けます");
      } else if (r.reason === "insufficient_gold") {
        toast("ゴールドが不足しています。設定 →「ゴールド」でチャージできます");
      } else {
        toast(r.message);
      }
    } finally {
      setGoldBusy(false);
    }
  }

  /** スーパーサンクス送信。 */
  async function sendThanks() {
    if (!tipTarget) return;
    setTipBusy(true);
    try {
      const r = await sendTip(
        tipTarget.id,
        tipAmount,
        tipTarget.productId,
        tipMsg.trim() || undefined,
      );
      if (r.ok) {
        toast(`💛 ${tipAmount} ゴールドを贈りました。応援ありがとうございます！`);
        setTipTarget(null);
        setTipMsg("");
      } else if (r.reason === "insufficient_gold") {
        toast("ゴールドが不足しています。設定 →「ゴールド」でチャージできます");
      } else {
        toast(r.message);
      }
    } finally {
      setTipBusy(false);
    }
  }

  /** サンクス・モーダル(全ビュー共通。tipTarget があるときだけ描画)。 */
  const tipModal =
    tipTarget !== null ? (
      <div className="tip-overlay" onClick={() => setTipTarget(null)}>
        <div className="tip-modal" onClick={(e) => e.stopPropagation()}>
          <h3 className="tip-title">
            <Heart size={16} /> スーパーサンクス
          </h3>
          <p className="muted" style={{ fontSize: 12.5 }}>
            「{tipTarget.name}」さんにゴールドで感謝を伝えます。ゴールドは
            クリエイターの制作を支えます(現金化はできません)。
          </p>
          <div className="tip-amounts">
            {[50, 100, 500, 1000].map((a) => (
              <button
                key={a}
                className={`tip-amt ${tipAmount === a ? "on" : ""}`}
                onClick={() => setTipAmount(a)}
              >
                {a} G
              </button>
            ))}
          </div>
          <input
            className="input"
            type="number"
            min={1}
            max={100000}
            value={tipAmount}
            onChange={(e) =>
              setTipAmount(Math.max(1, Math.floor(Number(e.target.value) || 0)))
            }
            aria-label="金額"
          />
          <textarea
            className="input"
            rows={2}
            maxLength={200}
            placeholder="応援メッセージ(任意・200 文字まで)"
            value={tipMsg}
            onChange={(e) => setTipMsg(e.target.value)}
            style={{ resize: "vertical" }}
          />
          <p className="muted" style={{ fontSize: 11.5 }}>
            所持: {goldBalance === null ? "—" : goldBalance.toLocaleString()} ゴールド
          </p>
          <div className="tip-actions">
            <button className="btn mini" onClick={() => setTipTarget(null)}>
              やめる
            </button>
            <button
              className="btn mini btn-primary"
              onClick={() => void sendThanks()}
              disabled={tipBusy || tipAmount < 1}
            >
              {tipBusy ? "送信中…" : `${tipAmount} G を贈る`}
            </button>
          </div>
        </div>
      </div>
    ) : null;

  // Esc で詳細を閉じて一覧へ戻る(マウス往復を省く)。
  useEffect(() => {
    if (!detail) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDetail(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail]);

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
        categories: cats,
        q,
        titleQ,
        creatorId: creatorFilter?.id ?? null,
        priceBand,
        saleOnly,
        onlyIds: wishOnly ? [...wishIds] : null,
        creatorIds: followOnly ? [...follows.keys()] : null,
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
    // wishKey/followKey: 絞り込み中のみ変更で再取得(OFF 時は無反応)。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cats, q, titleQ, creatorFilter, priceBand, saleOnly, wishOnly, wishKey, followOnly, followKey, sort, page]);

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
      // 類似品(同カテゴリの好評順)は非同期で遅れて出す。
      setSimilar([]);
      void fetchSimilarItems(d.productType, d.id)
        .then(setSimilar)
        .catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDetailLoading(false);
    }
  }

  function browseWith(opts: {
    category?: RemoteProductType | null;
    /** 大分類キー("works"/"chara"/"assets")。category より優先。 */
    group?: string;
    q?: string;
    creator?: { id: string; name: string } | null;
    sort?: StoreSort;
    priceBand?: StorePriceBand | null;
    saleOnly?: boolean;
  }) {
    setDetail(null);
    if (opts.group) {
      setGroupKey(opts.group);
      setSubType(null);
    } else if (opts.category) {
      setGroupKey(groupOfType(opts.category));
      setSubType(opts.category);
    } else {
      setGroupKey("all");
      setSubType(null);
    }
    setQ(opts.q ?? "");
    setQInput(opts.q ?? "");
    setCreatorFilter(opts.creator ?? null);
    // サイドバーの絞り込みは新しいブラウズ開始時にリセット(予測可能に)。
    setTitleQ("");
    setTitleQInput("");
    setPriceBand(opts.priceBand ?? null);
    setSaleOnly(opts.saleOnly ?? false);
    setWishOnly(false);
    if (opts.sort) setSort(opts.sort);
    setPage(1);
    setView("browse");
  }

  function search() {
    setDetail(null);
    setQ(qInput);
    setPage(1);
    setView("browse");
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
            {/* 左: ギャラリー(画像 / 動画) */}
            <div className="store-gallery">
              <div className="store-gmain">
                {mainImage ? (
                  isVideoUrl(mainImage) ? (
                    <video src={mainImage} controls preload="metadata" />
                  ) : (
                    <>
                      {/* 縦長画像の両脇を黒帯にせず、画像自身のぼかしで満たす
                          (Steam/配信サービスと同じレターボックス処理)。 */}
                      <img
                        className="store-gmain-bg"
                        src={mainImage}
                        alt=""
                        aria-hidden
                      />
                      <img
                        className="store-gmain-fg"
                        src={mainImage}
                        alt={detail.title}
                      />
                    </>
                  )
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
                      {isVideoUrl(url) ? (
                        <span className="store-gthumb-video">
                          <video src={url} muted preload="metadata" />
                          <Play size={16} aria-hidden />
                        </span>
                      ) : (
                        <img src={url} alt="" loading="lazy" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* ウィッシュリスト / 開発者フォロー(Steam のアクション行) */}
              <div className="sdx-actions">
                <button
                  className={`btn mini ibtn ${wishIds.has(detail.id) ? "sdx-on" : ""}`}
                  onClick={() => {
                    const added = toggleWish(detail.id);
                    toast(
                      added
                        ? "♥ ウィッシュリストに追加しました"
                        : "ウィッシュリストから外しました",
                    );
                  }}
                >
                  <Heart size={14} />{" "}
                  {wishIds.has(detail.id)
                    ? "ウィッシュリスト追加済み"
                    : "ウィッシュリストに追加"}
                </button>
                <button
                  className={`btn mini ibtn ${follows.has(detail.creator.id) ? "sdx-on" : ""}`}
                  title="フォローした開発者の作品は右サイドバーの「フォロー中」で絞り込めます"
                  onClick={() => {
                    const nm = detail.creator.displayName || "（無名）";
                    const added = toggleFollow(detail.creator.id, nm);
                    toast(
                      added
                        ? `${nm} をフォローしました`
                        : `${nm} のフォローを解除しました`,
                    );
                  }}
                >
                  {follows.has(detail.creator.id) ? (
                    <>
                      <UserCheck size={14} /> フォロー中
                    </>
                  ) : (
                    <>
                      <UserPlus size={14} /> 開発者をフォロー
                    </>
                  )}
                </button>
              </div>

              {/* 購入バー(Steam の「◯◯を購入する」) */}
              <div className="sdx-buybar">
                <div className="sdx-buybar-info">
                  <strong className="sdx-buybar-title">
                    {detail.title} を{effPriceOf(detail) === 0 ? "入手" : "購入"}する
                  </strong>
                </div>
                <div className="sdx-buybar-cta">
                  <PriceTag item={detail} size="lg" />
                  {isPurchased ? (
                    <button
                      className="btn btn-primary ibtn"
                      onClick={() => onGoLibrary?.()}
                    >
                      <LibraryBig size={15} /> ライブラリで開く
                    </button>
                  ) : !session ? (
                    <button
                      className="btn btn-primary ibtn"
                      onClick={() =>
                        requireLogin(
                          effPriceOf(detail) === 0
                            ? "ダウンロードにはログインが必要です。"
                            : "購入にはログインが必要です。",
                        )
                      }
                    >
                      <ShoppingCart size={15} /> ログインして
                      {effPriceOf(detail) === 0 ? "入手" : "購入"}
                    </button>
                  ) : (
                    <>
                      <button
                        className="btn btn-primary ibtn"
                        onClick={() => void openUrl(webProductUrl(detail.slug))}
                      >
                        <ShoppingCart size={15} />{" "}
                        {effPriceOf(detail) === 0
                          ? "無料で入手"
                          : `${formatPriceJpy(effPriceOf(detail))} で購入`}
                      </button>
                      {effPriceOf(detail) > 0 && (
                        <button
                          className="btn ibtn"
                          onClick={() => void buyWithGold()}
                          disabled={goldBusy}
                          title={
                            goldBalance !== null
                              ? `所持: ${goldBalance} ゴールド`
                              : "ゴールドで購入"
                          }
                        >
                          <Coins size={15} />{" "}
                          {goldBusy
                            ? "処理中…"
                            : `${effPriceOf(detail).toLocaleString()} G で購入`}
                        </button>
                      )}
                    </>
                  )}
                </div>
                {!isPurchased && session && effPriceOf(detail) > 0 && (
                  <p className="sdx-gold-note muted">
                    <Coins size={11} /> ゴールドでも購入できます
                    {goldBalance !== null && `（所持 ${goldBalance.toLocaleString()}）`}
                    。ゴールドは AI 利用やクリエイター支援にも使えます。
                  </p>
                )}
              </div>

              <h3 className="store-sec">作品について</h3>
              <p className="store-desc">{detail.description || "（説明なし）"}</p>

              <h3 className="store-sec">
                みんなのレビュー <ReviewBadge review={detail.review} />
                {detail.review && detail.review.total > 0 && (
                  <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>
                    （{detail.review.total}件）
                  </span>
                )}
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

            {/* 右: 情報ボックス(Steam の右上カプセル) / 仕様メタ */}
            <aside className="store-side">
              <div className="sdx-info">
                {detail.coverUrl && (
                  <div className="sdx-info-cover">
                    <img src={detail.coverUrl} alt="" />
                  </div>
                )}
                {isPurchased && (
                  <span className="work-badge done store-owned">✓ 購入済み</span>
                )}
                <p className="sdx-info-desc">
                  {detail.description || "（説明なし）"}
                </p>
                <dl className="sdx-info-rows">
                  <dt>レビュー:</dt>
                  <dd>
                    <ReviewBadge review={detail.review} />
                  </dd>
                  <dt>公開日:</dt>
                  <dd>
                    {new Date(detail.publishedAt).toLocaleDateString("ja-JP")}
                  </dd>
                  <dt>開発元:</dt>
                  <dd>
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
                      {detail.creator.avatarUrl ? (
                        <img
                          className="sdx-dev-avatar"
                          src={detail.creator.avatarUrl}
                          alt=""
                        />
                      ) : null}
                      {detail.creator.displayName || "（無名）"}
                    </button>
                  </dd>
                </dl>
                {detail.tags.length > 0 && (
                  <div className="sdx-info-tags">
                    <span className="sdx-info-tags-label">
                      この作品の人気タグ:
                    </span>
                    <div className="store-tags">
                      {detail.tags.map((t) => (
                        <button
                          key={t}
                          className="store-tag"
                          title={`タグ「${t}」で検索`}
                          onClick={() => browseWith({ q: t })}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* スーパーサンクス(クリエイターへゴールドを贈る。購入不要) */}
                {detail.creator.id && (
                  <button
                    className="sdx-thanks-btn ibtn"
                    onClick={() =>
                      openTip({
                        id: detail.creator.id,
                        name: detail.creator.displayName || "（無名）",
                        productId: detail.id,
                      })
                    }
                    title="このクリエイターにゴールドで感謝を伝える"
                  >
                    <Heart size={14} /> スーパーサンクスで応援
                  </button>
                )}
              </div>

              <div className="store-meta">
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
              </div>
            </aside>
          </div>

          {/* 類似品(同カテゴリの好評作品) */}
          {similar.length > 0 && (
            <div className="sdx-similar">
              <h3 className="store-sec">類似の作品</h3>
              <div className="sdx-similar-grid">
                {similar.map((it) => (
                  <button
                    key={it.id}
                    className="sdx-sim-card"
                    onClick={() => void openDetail(it)}
                    title={it.title}
                  >
                    <span className="sdx-sim-thumb">
                      {it.coverUrl ? (
                        <img src={it.coverUrl} alt="" loading="lazy" />
                      ) : (
                        <span className="store-noimg">No Image</span>
                      )}
                    </span>
                    <span className="sdx-sim-title">{it.title}</span>
                    <span className="sdx-sim-price">
                      <PriceTag item={it} />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {tipModal}
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
                <div key={c.id} className="creator-cardwrap">
                  <button
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
                  <button
                    className="creator-thanks"
                    onClick={() =>
                      openTip({ id: c.id, name: c.displayName || "（無名）" })
                    }
                    title="このクリエイターにスーパーサンクスを贈る"
                  >
                    <Heart size={13} /> 応援
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        {tipModal}
      </div>
    );
  }

  /* ===== ホームビュー(Steam フロントページ) ===== */
  if (view === "home") {
    return (
      <div className="store">
        {header}
        {/* ジャンルナビ(大分類: 作品 / キャラ / 素材)。細分化はブラウズ側で。 */}
        <div className="store-cats">
          {CAT_GROUPS.filter((g) => g.types).map((g) => (
            <button
              key={g.key}
              className="store-cat ibtn"
              onClick={() => browseWith({ group: g.key })}
            >
              {CATEGORY_ICON[g.types![0]]}
              {g.label}
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
            <div className="shome shome-dsn" aria-busy={detailLoading}>
              <StoreAmbientApp />
              <div className="shome-grid">
                <div className="shome-main">
                  <section>
                    <StoreHeroBanner
                      featured={home.featured[0] ?? null}
                      total={home.overview.total}
                      onSearch={(q) => browseWith({ q })}
                      onQuickTag={(opts) => browseWith(opts)}
                      onOpen={(it) => void openDetail(it)}
                    />
                    <TrustBar overview={home.overview} />
                  </section>

                  <CategoryDiceSec
                    counts={home.overview.categoryCounts}
                    onPick={(c) => browseWith({ category: c })}
                  />

                  <RankingSec
                    items={home.topRated.slice(0, 6)}
                    onOpen={(it) => void openDetail(it)}
                    onMore={() => browseWith({ sort: "rating" })}
                  />

                  <SaleStripSec
                    items={home.onSale}
                    onOpen={(it) => void openDetail(it)}
                    onMore={() => browseWith({ saleOnly: true })}
                  />

                  <NewWorksSec
                    items={home.recent.slice(0, 9)}
                    wished={wishIds}
                    onOpen={(it) => void openDetail(it)}
                    onMore={() => browseWith({ sort: "published" })}
                  />

                  <CreatorsSec
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

                  <BuilderCta onOpenBuilder={onOpenBuilder} />
                </div>

                <aside className="shome-side">
                  <StoreFilterSidebar
                    counts={home.overview.categoryCounts}
                    onApply={(opts) => browseWith(opts)}
                  />
                  <PlayMiniCard
                    onOpenPlay={onOpenPlay}
                    onGoLibrary={onGoLibrary}
                  />
                </aside>
              </div>
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
        {/* 大分類: すべて / 作品 / キャラ / 素材 */}
        {CAT_GROUPS.map((g) => (
          <button
            key={g.key}
            className={`store-cat ${groupKey === g.key ? "active" : ""}`}
            onClick={() => {
              setGroupKey(g.key);
              setSubType(null);
              setPage(1);
            }}
          >
            {g.label}
          </button>
        ))}
        {/* 小分類(細分化): 選択中の大分類にサブがあるときだけ */}
        {(CAT_GROUPS.find((g) => g.key === groupKey)?.subs ?? []).map((s) => (
          <button
            key={s.key}
            className={`store-cat sub ${subType === s.key ? "active" : ""}`}
            onClick={() => {
              setSubType((cur) => (cur === s.key ? null : s.key));
              setPage(1);
            }}
          >
            {s.label}
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
          <>
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
            <button
              className="store-qchip-thanks"
              onClick={() =>
                openTip({ id: creatorFilter.id, name: creatorFilter.name })
              }
              title="このクリエイターにスーパーサンクスを贈る"
            >
              <Heart size={12} /> 応援する
            </button>
          </>
        )}
        <span className="store-count muted">{items ? `${total} 件` : ""}</span>
      </div>

      {error && (
        <p className="tag fail" style={{ margin: "4px 16px" }}>
          {error}
        </p>
      )}

      <div className="store-body browse-flex">
        {/* 右サイドバー: 名前検索 / 並び替え / 価格帯 / セール中 / ウィッシュ */}
        <aside className="store-filters">
          <div className="sf-sec">
            <p className="sf-title">作品名で絞り込み</p>
            <input
              className="input"
              value={titleQInput}
              placeholder="作品名の一部"
              onChange={(e) => setTitleQInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setTitleQ(titleQInput);
                  setPage(1);
                }
              }}
              onBlur={() => {
                if (titleQInput !== titleQ) {
                  setTitleQ(titleQInput);
                  setPage(1);
                }
              }}
            />
          </div>

          <div className="sf-sec">
            <p className="sf-title">並び替え</p>
            <select
              className="input"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as StoreSort);
                setPage(1);
              }}
            >
              <option value="published">新着順</option>
              <option value="rating">評価が高い順</option>
              <option value="price_asc">価格が安い順</option>
              <option value="price_desc">価格が高い順</option>
            </select>
          </div>

          <div className="sf-sec">
            <p className="sf-title">価格</p>
            <div className="sf-chips">
              {(
                [
                  [null, "すべて"],
                  ["free", "無料"],
                  ["u500", "〜500円"],
                  ["mid", "500〜1,000円"],
                  ["o1000", "1,000円〜"],
                ] as [StorePriceBand | null, string][]
              ).map(([band, label]) => (
                <button
                  key={label}
                  className={`sf-chip ${priceBand === band ? "active" : ""}`}
                  onClick={() => {
                    setPriceBand(band);
                    setPage(1);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="sf-sec">
            <label className="sf-check">
              <input
                type="checkbox"
                checked={saleOnly}
                onChange={(e) => {
                  setSaleOnly(e.target.checked);
                  setPage(1);
                }}
              />
              🔥 セール中のみ
            </label>
            <label className="sf-check">
              <input
                type="checkbox"
                checked={wishOnly}
                onChange={(e) => {
                  setWishOnly(e.target.checked);
                  setPage(1);
                }}
              />
              <Heart size={12} /> ウィッシュリストのみ
              {wishIds.size > 0 && (
                <span className="muted">({wishIds.size})</span>
              )}
            </label>
            <label className="sf-check">
              <input
                type="checkbox"
                checked={followOnly}
                onChange={(e) => {
                  setFollowOnly(e.target.checked);
                  setPage(1);
                }}
              />
              <UserCheck size={12} /> フォロー中の開発者
              {follows.size > 0 && (
                <span className="muted">({follows.size})</span>
              )}
            </label>
          </div>

          {(titleQ || priceBand || saleOnly || wishOnly || followOnly) && (
            <button
              className="btn mini sf-clear"
              onClick={() => {
                setTitleQ("");
                setTitleQInput("");
                setPriceBand(null);
                setSaleOnly(false);
                setWishOnly(false);
                setFollowOnly(false);
                setPage(1);
              }}
            >
              絞り込みをクリア
            </button>
          )}
        </aside>

        <div className="browse-main">
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
                <div key={it.id} className="store-cardwrap">
                  <button
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
                    {/* Steam 型: ほぼサムネ + 下に価格。作者/レビュー/タグ等は
                        クリック後の詳細パネルにまとめて表示する。 */}
                    <div className="store-card-body">
                      <span className="store-card-title">{it.title}</span>
                      <span className="store-card-foot">
                        <PriceTag item={it} />
                        <ReviewBadge review={it.review} />
                      </span>
                    </div>
                  </button>
                  {/* ウィッシュ(ハート)。カードは <button> なので兄弟として重ねる。 */}
                  <button
                    className={`wish-btn ${wishIds.has(it.id) ? "on" : ""}`}
                    title={
                      wishIds.has(it.id)
                        ? "ウィッシュリストから外す"
                        : "ウィッシュリストに追加"
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      const added = toggleWish(it.id);
                      toast(
                        added
                          ? "♥ ウィッシュリストに追加しました"
                          : "ウィッシュリストから外しました",
                      );
                    }}
                  >
                    <Heart
                      size={15}
                      fill={wishIds.has(it.id) ? "currentColor" : "none"}
                    />
                  </button>
                </div>
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
      {tipModal}
    </div>
  );
}

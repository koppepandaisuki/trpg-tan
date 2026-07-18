import Link from "next/link";
import type { Route } from "next";
import { Search } from "lucide-react";
import { CoverImage } from "./cover-image";
import { publicCoverUrl } from "@/lib/format/storage";
import { categoryLabel } from "@/lib/format/category";
import type { ProductListItem } from "@/lib/queries/types";

/** ヒーローのクイックタグ。タグ/カテゴリ/価格/セールが混在するので href を直接持つ。 */
const QUICK_LINKS: { label: string; href: Route }[] = [
  { label: "初心者におすすめ", href: "/store?tag=初心者におすすめ" as Route },
  { label: "ホラー", href: "/store?tag=ホラー" as Route },
  { label: "短時間で遊べる", href: "/store?tag=短時間" as Route },
  { label: "フルパッケージ", href: "/store?category=full_package" as Route },
  { label: "セール中", href: "/store?sale=1" as Route },
  { label: "無料作品", href: "/store?price=free" as Route },
];

/**
 * ストア最上部のヒーローバナー(Re-dice Store.dc.html)。
 * 深紅グラデーション + 検索バー + クイックタグ + 注目作品(16:9 カバー)。
 * 背景のダイス装飾はページ全体の StoreAmbient に移し、ここではヒーロー
 * 下端の薄い装飾ダイス 1 つだけを持つ。
 *
 * 検索は JS 不要のプレーン GET フォーム(`/store?q=...`)。
 */
export function StoreHero({
  total,
  featured,
}: {
  total: number;
  featured: ProductListItem | null;
}) {
  const coverUrl = featured ? publicCoverUrl(featured.coverPath) : null;

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-[#5a1119]/50 shadow-[0_24px_60px_rgba(90,17,25,.28)]"
      style={{
        background:
          "radial-gradient(120% 140% at 88% 0%, rgba(201,162,39,.28), transparent 46%), linear-gradient(120deg,#7d1a22,#a3202c 55%,#5a1119)",
      }}
    >
      {/* 対角線ストライプの薄いオーバーレイ */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(118deg, rgba(255,255,255,.04) 0 1px, transparent 1px 16px)",
        }}
      />
      {/* ヒーロー下端の薄い装飾ダイス(4 の目) */}
      <div
        aria-hidden
        className="absolute"
        style={{
          left: "36%",
          bottom: -16,
          width: 64,
          height: 64,
          borderRadius: 16,
          border: "2px solid rgba(243,230,200,.22)",
          transform: "rotate(-12deg)",
          backgroundRepeat: "no-repeat",
          backgroundImage:
            "radial-gradient(circle 4px at 30% 30%, rgba(243,230,200,.22) 95%, transparent),radial-gradient(circle 4px at 70% 30%, rgba(243,230,200,.22) 95%, transparent),radial-gradient(circle 4px at 30% 70%, rgba(243,230,200,.22) 95%, transparent),radial-gradient(circle 4px at 70% 70%, rgba(243,230,200,.22) 95%, transparent)",
        }}
      />

      <div className="relative z-10 grid grid-cols-1 items-center gap-9 p-6 sm:p-9 md:grid-cols-[minmax(0,1fr)_280px]">
        {/* 左カラム: kicker / 見出し / 検索 / クイックタグ */}
        <div>
          <div className="mb-3.5 flex items-center gap-2.5">
            <span className="die-ico on-dark" aria-hidden />
            <span className="text-[11px] font-bold tracking-[0.24em] text-[#e9cf7f]">
              CREATOR MARKETPLACE FOR TRPG
            </span>
          </div>
          <h1 className="font-serif text-[27px] font-bold leading-[1.3] text-white sm:text-[32px] lg:text-[36px]">
            <span className="whitespace-nowrap">あなたの次の物語を、</span>
            <br />
            <span className="whitespace-nowrap">ここで見つける。</span>
          </h1>
          <p className="mt-3.5 max-w-[460px] text-[13.5px] leading-[1.9] text-white/82">
            シナリオ・ルールブック・マップ・アート・BGM。買ってすぐ卓が立てられる
            <b className="font-bold text-[#f3e6c8]">
              完成品が{total.toLocaleString("ja-JP")}点
            </b>
            。クリエイターの手から、あなたの卓へ。
          </p>

          <form
            action="/store"
            method="GET"
            role="search"
            className="mt-5 flex h-[52px] max-w-[440px] items-center gap-2.5 rounded-[14px] bg-white py-0 pl-[18px] pr-2 shadow-[0_12px_30px_rgba(0,0,0,.22)]"
          >
            <Search className="h-[18px] w-[18px] shrink-0 text-[#B02832]" aria-hidden />
            <input
              type="search"
              name="q"
              maxLength={100}
              placeholder="「クトゥルフ 初心者」で探す…"
              aria-label="作品名・作者・タグで検索"
              className="min-w-0 flex-1 border-none bg-transparent text-[13.5px] text-foreground placeholder:text-[#a9967d] focus:outline-none"
            />
            <button
              type="submit"
              className="inline-flex h-[38px] shrink-0 items-center rounded-[10px] bg-[#B02832] px-5 text-[13px] font-bold text-white transition hover:bg-[#93202A]"
            >
              検索
            </button>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            {QUICK_LINKS.map((q) => (
              <Link
                key={q.label}
                href={q.href}
                className="rounded-full border border-white/25 bg-white/12 px-3.5 py-[5px] text-[11.5px] font-semibold text-white transition hover:border-white/45 hover:bg-white/[.22]"
              >
                {q.label}
              </Link>
            ))}
          </div>
        </div>

        {/* 右カラム: 注目作品(16:9 カバー・傾き付き) */}
        {featured && (
          <Link
            href={`/store/${featured.slug}`}
            className="group relative block aspect-video self-center overflow-hidden rounded-[14px] border border-[#C9A227]/40 shadow-[0_24px_50px_rgba(0,0,0,.35)] transition-[transform,box-shadow] duration-300 [transform:rotate(2deg)] hover:shadow-[0_30px_60px_rgba(0,0,0,.42)] hover:[transform:rotate(0deg)_translateY(-4px)]"
            aria-label={`注目作品「${featured.title}」の詳細を見る`}
          >
            <div className="absolute inset-0">
              <CoverImage
                src={coverUrl}
                alt={featured.title}
                aspect="aspect-video"
                className="h-full"
              />
            </div>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/[.68] via-black/5 to-black/10" />
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3.5">
              <span className="self-start rounded-full bg-[#E9CF7F] px-2.5 py-[3px] text-[10px] font-extrabold tracking-wider text-[#4a3a12]">
                今月の注目
              </span>
              <div>
                <p className="font-serif text-[17px] font-extrabold leading-tight text-[#f3e6c8] [text-shadow:0_2px_12px_rgba(0,0,0,.4)]">
                  {featured.title}
                </p>
                <p className="mt-0.5 text-[10.5px] text-[#e9cf7f]/85">
                  {categoryLabel(featured.productType)}
                  {featured.creator.displayName
                    ? ` ・ ${featured.creator.displayName}`
                    : ""}
                </p>
              </div>
            </div>
          </Link>
        )}
      </div>
    </section>
  );
}

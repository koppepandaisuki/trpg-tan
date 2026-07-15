import Link from "next/link";
import type { Route } from "next";
import { Search } from "lucide-react";
import { CoverImage } from "./cover-image";
import { publicCoverUrl } from "@/lib/format/storage";
import { categoryLabel } from "@/lib/format/category";
import { DiceAmbient } from "./dice-ambient";
import type { ProductListItem } from "@/lib/queries/types";

/** ヒーローのクイックタグ。タグ/カテゴリ/価格フィルタが混在するので href を直接持つ。 */
const QUICK_LINKS: { label: string; href: Route }[] = [
  { label: "初心者におすすめ", href: "/store?tag=初心者におすすめ" as Route },
  { label: "ホラー", href: "/store?tag=ホラー" as Route },
  { label: "短時間で遊べる", href: "/store?tag=短時間" as Route },
  { label: "フルパッケージ", href: "/store?category=full_package" as Route },
  { label: "無料作品", href: "/store?price=free" as Route },
];

/**
 * ストア最上部のヒーローバナー(design_handoff_store_redesign 案A)。
 * 深紅グラデーション + サイコロのアンビエント演出 + 検索バー + クイックタグ +
 * 注目作品(フルパッケージ優先)のカバーを右カラムに大きく見せる。
 *
 * 検索は JS 不要のプレーン GET フォーム(`/store?q=...`)。既存の
 * client component `SearchBar`(ヘッダー用)とは別に、この見た目専用の
 * フォームをここで完結させる(Server Component のまま保てる)。
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
      className="relative overflow-hidden rounded-2xl border border-[#5a1119]/40 shadow-lg"
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
      <DiceAmbient />

      <div className="relative z-10 grid grid-cols-1 items-center gap-8 p-6 sm:p-10 md:grid-cols-[1fr_280px] md:gap-10 md:p-11">
        {/* 左カラム: kicker / 見出し / 検索 / クイックタグ */}
        <div>
          <div className="mb-3.5 flex items-center gap-2.5">
            <span className="die-ico on-dark" aria-hidden />
            <span className="text-[11px] font-bold tracking-[0.22em] text-[#e9cf7f]">
              CREATOR MARKETPLACE FOR TRPG
            </span>
          </div>
          <h1 className="font-serif text-[32px] font-bold leading-[1.2] text-white sm:text-[38px] lg:text-[44px]">
            あなたの次の物語を、
            <br />
            ここで見つける。
          </h1>
          <p className="mt-3.5 max-w-[520px] text-[15px] leading-[1.85] text-white/82">
            シナリオ・ルールブック・マップ・アート・BGM。買ってすぐ卓が立てられる作品が
            {total.toLocaleString("ja-JP")}点。クリエイターが手がけた完成品を、あなたの卓へ。
          </p>

          <form
            action="/store"
            method="GET"
            role="search"
            className="mt-6 flex h-[52px] max-w-[520px] items-center gap-2.5 rounded-[14px] bg-white px-4 shadow-[0_12px_30px_rgba(0,0,0,.22)]"
          >
            <Search className="h-5 w-5 shrink-0 text-[#B02832]" aria-hidden />
            <input
              type="search"
              name="q"
              maxLength={100}
              placeholder="「クトゥルフ 初心者」で探す…"
              aria-label="作品名・作者・タグで検索"
              className="min-w-0 flex-1 border-none bg-transparent text-[14.5px] text-foreground placeholder:text-[#a9967d] focus:outline-none"
            />
            <button
              type="submit"
              className="inline-flex h-[38px] shrink-0 items-center rounded-[10px] bg-[#B02832] px-5 text-sm font-semibold text-white transition hover:bg-[#93202A]"
            >
              検索
            </button>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            {QUICK_LINKS.map((q) => (
              <Link
                key={q.label}
                href={q.href}
                className="rounded-full border border-white/25 bg-white/12 px-3.5 py-1.5 text-[12.5px] font-medium text-white transition hover:border-white/40 hover:bg-white/18"
              >
                {q.label}
              </Link>
            ))}
          </div>
        </div>

        {/* 右カラム: 注目作品(フルパッケージ優先) */}
        {featured && (
          <Link
            href={`/store/${featured.slug}`}
            className="group relative block aspect-[3/4] overflow-hidden rounded-2xl border border-[#C9A227]/40 shadow-[0_24px_50px_rgba(0,0,0,.35)]"
            style={{ transform: "rotate(2deg)" }}
            aria-label={`注目作品「${featured.title}」の詳細を見る`}
          >
            <div className="absolute inset-0">
              <CoverImage
                src={coverUrl}
                alt={featured.title}
                aspect="aspect-[3/4]"
                className="h-full transition-transform duration-300 group-hover:scale-105"
              />
            </div>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-black/10" />
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-5">
              <span className="self-start rounded-full bg-[#C9A227] px-2.5 py-1 text-[10px] font-extrabold tracking-wider text-[#4a3a12]">
                今月の注目
              </span>
              <div>
                <p className="font-serif text-2xl font-bold leading-tight text-[#f3e6c8] [text-shadow:0_2px_12px_rgba(0,0,0,.4)]">
                  {featured.title}
                </p>
                {featured.systemLabel && (
                  <p className="mt-1.5 text-[11.5px] text-[#e9cf7f]/80">
                    {featured.systemLabel}
                  </p>
                )}
                {!featured.systemLabel && (
                  <p className="mt-1.5 text-[11.5px] text-[#e9cf7f]/80">
                    {categoryLabel(featured.productType)}
                  </p>
                )}
              </div>
            </div>
          </Link>
        )}
      </div>
    </section>
  );
}

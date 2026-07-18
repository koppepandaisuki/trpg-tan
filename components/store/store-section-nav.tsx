import Link from "next/link";
import type { Route } from "next";

/**
 * ランディング専用のセクションナビ(Re-dice Store.dc.html のヘッダーナビを
 * グローバルヘッダーと二重にならないよう細い帯として移植)。
 * TopHeader(sticky h-16)の直下に貼り付き、ページ内アンカーで各
 * セクションへ飛ぶ。右端に出品 CTA。
 */
const ANCHORS: { label: string; href: string }[] = [
  { label: "カテゴリ", href: "#categories" },
  { label: "ランキング", href: "#ranking" },
  { label: "セール", href: "#sale" },
  { label: "新着", href: "#new" },
  { label: "クリエイター", href: "#creators" },
];

export function StoreSectionNav() {
  return (
    <nav
      aria-label="ストア内セクション"
      className="sticky top-16 z-30 border-b border-[#E8DCC5]/80 bg-[#FFFDF9]/85 px-4 backdrop-blur-md sm:px-6"
    >
      <div className="mx-auto flex h-11 max-w-screen-2xl items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ANCHORS.map((a) => (
          <a
            key={a.href}
            href={a.href}
            className="whitespace-nowrap rounded-lg px-2.5 py-[7px] text-[13px] font-semibold text-foreground transition hover:bg-muted hover:text-accent"
          >
            {a.label}
          </a>
        ))}
        <Link
          href={"/creator/products/new" as Route}
          className="ml-auto inline-flex h-[30px] shrink-0 items-center whitespace-nowrap rounded-[9px] bg-[#B02832] px-3 text-xs font-bold text-white transition hover:bg-[#93202A]"
        >
          出品する
        </Link>
      </div>
    </nav>
  );
}

import Link from "next/link";
import type { Route } from "next";
import {
  FileText,
  BookOpen,
  Map,
  Palette,
  Music,
  LayoutGrid,
  ArrowRight,
} from "lucide-react";
import { STORE_CATEGORIES } from "@/lib/format/category";
import type { ProductType } from "@/lib/queries/types";
import { cn } from "@/lib/utils";

/**
 * Steam ライクなカテゴリ入口グリッド。トップページから 1 クリックで
 * `/store?category=xxx` にジャンプできるショートカット。
 *
 * 視覚改善(他ページの hero / strip と統一の触感):
 *  - セクション見出しに LayoutGrid アイコン + 説明文を追加
 *  - 各カードのアイコンを円形背景の中に配置(他ページのアイコンと統一)
 *  - 説明文(短いコピー)で「何のカテゴリか」を一目で伝える
 *  - hover で scale + shadow + ArrowRight が右にスライド(Steam の "Browse all" 同様)
 *
 * 「すべて」のショートカットは含めない(ナビバーやメニューから /store
 * に直接行ける、ここはカテゴリ別の入口のみ)。
 */

const ICONS: Record<ProductType, React.ComponentType<{ className?: string }>> = {
  scenario: FileText,
  rulebook: BookOpen,
  map: Map,
  character_art: Palette,
  bgm_audio: Music,
};

/**
 * カードのトーン(背景グラデ + アイコン背景 + アイコン色 + テキスト色)を
 * カテゴリごとに統一管理。他ページの emerald/indigo/violet/amber/rose と
 * 同じパレットから選んでサイト全体の視覚言語に揃える。
 */
const TONES: Record<
  ProductType,
  {
    gradient: string;
    iconBg: string;
    iconBorder: string;
    iconColor: string;
  }
> = {
  scenario: {
    gradient: "from-sky-500/15 to-sky-500/5",
    iconBg: "bg-sky-50",
    iconBorder: "border-sky-200",
    iconColor: "text-sky-700",
  },
  rulebook: {
    gradient: "from-emerald-500/15 to-emerald-500/5",
    iconBg: "bg-emerald-50",
    iconBorder: "border-emerald-200",
    iconColor: "text-emerald-700",
  },
  map: {
    gradient: "from-amber-500/15 to-amber-500/5",
    iconBg: "bg-amber-50",
    iconBorder: "border-amber-200",
    iconColor: "text-amber-700",
  },
  character_art: {
    gradient: "from-rose-500/15 to-rose-500/5",
    iconBg: "bg-rose-50",
    iconBorder: "border-rose-200",
    iconColor: "text-rose-700",
  },
  bgm_audio: {
    gradient: "from-violet-500/15 to-violet-500/5",
    iconBg: "bg-violet-50",
    iconBorder: "border-violet-200",
    iconColor: "text-violet-700",
  },
};

/**
 * カテゴリの「短いキャッチコピー」。何が手に入るかを 1 行で伝えて
 * カードの情報密度を上げる(Steam のカテゴリカードと同様の役割)。
 */
const DESCRIPTIONS: Record<ProductType, string> = {
  scenario: "ストーリーと舞台設定",
  rulebook: "ハウスルール・追加システム",
  map: "戦闘マップ・地図",
  character_art: "立ち絵・アートワーク",
  bgm_audio: "BGM・効果音",
};

export function CategoryGrid() {
  const items = STORE_CATEGORIES.filter(
    (c): c is { value: ProductType; label: string } => c.value !== null,
  );

  return (
    <section className="space-y-4">
      {/* 見出し行 — ProductStrip の見出しトーンと統一(LayoutGrid アイコンで
          「グリッドで一覧する」入口感を表現)*/}
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-sky-700">
          <LayoutGrid className="h-4 w-4" aria-hidden />
        </div>
        <div className="space-y-0.5">
          <h2 className="text-lg font-semibold tracking-tight">カテゴリで探す</h2>
          <p className="text-xs text-muted-foreground">
            ジャンルから作品を絞り込んで探せます
          </p>
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((cat) => {
          const Icon = ICONS[cat.value];
          const tone = TONES[cat.value];
          const description = DESCRIPTIONS[cat.value];
          const href = `/store?category=${cat.value}` as Route;
          return (
            <li key={cat.value}>
              <Link
                href={href}
                className={cn(
                  "group flex aspect-[5/3] flex-col justify-between rounded-lg border border-border bg-gradient-to-br p-4 shadow-sm transition-all",
                  "hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md",
                  tone.gradient,
                )}
                aria-label={`「${cat.label}」カテゴリの作品一覧へ`}
              >
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border transition-transform duration-300 group-hover:scale-110",
                    tone.iconBg,
                    tone.iconBorder,
                    tone.iconColor,
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-sm font-semibold tracking-tight">
                      {cat.label}
                    </span>
                    <ArrowRight
                      className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground"
                      aria-hidden
                    />
                  </div>
                  <p className="line-clamp-1 text-[11px] text-muted-foreground">
                    {description}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

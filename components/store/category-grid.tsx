import Link from "next/link";
import type { Route } from "next";
import { FileText, BookOpen, Map, Palette, Music } from "lucide-react";
import { STORE_CATEGORIES } from "@/lib/format/category";
import type { ProductType } from "@/lib/queries/types";
import { cn } from "@/lib/utils";

/**
 * Steam ライクなカテゴリ入口グリッド。トップページから 1 クリックで
 * `/store?category=xxx` にジャンプできるショートカット。
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

const TONES: Record<ProductType, string> = {
  scenario: "from-indigo-500/15 to-indigo-500/5 text-indigo-700",
  rulebook: "from-emerald-500/15 to-emerald-500/5 text-emerald-700",
  map: "from-amber-500/15 to-amber-500/5 text-amber-700",
  character_art: "from-rose-500/15 to-rose-500/5 text-rose-700",
  bgm_audio: "from-violet-500/15 to-violet-500/5 text-violet-700",
};

export function CategoryGrid() {
  const items = STORE_CATEGORIES.filter(
    (c): c is { value: ProductType; label: string } => c.value !== null,
  );

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">カテゴリで探す</h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((cat) => {
          const Icon = ICONS[cat.value];
          const tone = TONES[cat.value];
          const href = `/store?category=${cat.value}` as Route;
          return (
            <li key={cat.value}>
              <Link
                href={href}
                className={cn(
                  "group flex aspect-[5/3] flex-col justify-between rounded-lg border border-border bg-gradient-to-br p-4 transition hover:shadow-md hover:scale-[1.02]",
                  tone,
                )}
              >
                <Icon className="h-6 w-6" aria-hidden />
                <span className="text-sm font-semibold tracking-tight">
                  {cat.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

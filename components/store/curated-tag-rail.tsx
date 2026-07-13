import Link from "next/link";
import type { Route } from "next";
import { Compass, Sparkles, Clock, Users, Drama, type LucideIcon } from "lucide-react";
import {
  CURATED_TAG_GROUPS,
  curatedTagsByGroup,
  type CuratedTagGroupId,
} from "@/lib/format/curated-tags";
import { cn } from "@/lib/utils";

/**
 * 「テーマで探す」レール。編集部が選んだ正規の探索タグ(初心者におすすめ /
 * 短時間 / ホラー …)をグループ別チップで並べ、クリックで `/store?tag=...`
 * のタグ検索に飛ばす。既存のタグ絞り込みをそのまま使う(DB 変更なし)。
 *
 * `current` に現在の ?tag を渡すと、一致するチップを active 表示にする。
 * フィルタ解除はストア上部の hero chip 側が担うので、ここは「今どのテーマを
 * 見ているか」を示すだけ(active チップも自分自身へのリンクのまま)。
 */
export function CuratedTagRail({ current }: { current?: string | null }) {
  return (
    <section
      aria-label="テーマで探す"
      className="rounded-xl border border-border bg-gradient-to-br from-amber-500/[0.04] via-transparent to-red-500/[0.04] p-4 sm:p-5"
    >
      <div className="mb-3 flex items-center gap-2">
        <Compass className="h-4 w-4 text-amber-600" aria-hidden />
        <h2 className="text-sm font-semibold tracking-tight">テーマで探す</h2>
        <span className="text-xs text-muted-foreground">
          遊びやすさ・時間・人数・雰囲気から
        </span>
      </div>

      <div className="space-y-3">
        {CURATED_TAG_GROUPS.map((group) => {
          const Icon = GROUP_ICON[group.id];
          const tags = curatedTagsByGroup(group.id);
          return (
            <div key={group.id} className="flex flex-col gap-1.5 sm:flex-row sm:items-start">
              <div className="flex shrink-0 items-center gap-1.5 pt-0.5 sm:w-28">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => {
                  const isActive = current === t.tag;
                  const href = `/store?tag=${encodeURIComponent(t.tag)}` as Route;
                  return (
                    <Link
                      key={t.tag}
                      href={href}
                      title={t.description}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition",
                        isActive
                          ? "border-amber-500 bg-amber-600 text-white shadow-sm"
                          : "border-amber-200 bg-amber-50/60 text-amber-800 hover:border-amber-300 hover:bg-amber-100",
                      )}
                    >
                      {t.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const GROUP_ICON: Record<CuratedTagGroupId, LucideIcon> = {
  play: Sparkles,
  time: Clock,
  players: Users,
  mood: Drama,
};

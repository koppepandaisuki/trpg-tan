"use client";

import { Sparkles, Plus, Check } from "lucide-react";
import {
  CURATED_TAG_GROUPS,
  curatedTagsByGroup,
} from "@/lib/format/curated-tags";
import { cn } from "@/lib/utils";

/**
 * ビルダーの「おすすめの探索タグ」ピッカー。ストアの「テーマで探す」レールと
 * 同じ正規語彙(CURATED_TAGS)を提示し、クリックで canonical な `tag` を追加する。
 *
 * 狙い: クリエイターがバラバラの表記(初心者OK / 初心者向け / ビギナー …)を
 * 使うと探索の入口がぼやけるので、ここで表記を揃え、探索タグに引っかかりやすく
 * する。表示は `label`(GMしやすい 等の整形名)、保存されるのは `tag`(回しやすい)。
 *
 * 既存の TagSuggestions(人気タグ = 組織的な使われ方)とは別物。こちらは編集部の
 * 正規セットで、上限到達時は無効化、選択済みはトグルで外せる。
 */
export function CuratedTagPicker({
  selectedTags,
  onAdd,
  onRemove,
  atMax,
}: {
  selectedTags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  atMax: boolean;
}) {
  return (
    <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50/40 p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-violet-600" aria-hidden />
        <p className="text-xs font-semibold text-violet-900">
          おすすめの探索タグ
        </p>
        <span className="text-[11px] text-violet-700/80">
          テーマ別。付けるとストアの「テーマで探す」から見つけてもらえます
        </span>
      </div>

      <div className="space-y-2">
        {CURATED_TAG_GROUPS.map((group) => (
          <div key={group.id} className="flex flex-col gap-1 sm:flex-row sm:items-start">
            <span className="shrink-0 pt-1 text-[10px] font-semibold uppercase tracking-wider text-violet-700/70 sm:w-24">
              {group.label}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {curatedTagsByGroup(group.id).map((t) => {
                const selected = selectedTags.includes(t.tag);
                const disabled = !selected && atMax;
                return (
                  <button
                    type="button"
                    key={t.tag}
                    title={t.description}
                    disabled={disabled}
                    onClick={() =>
                      selected ? onRemove(t.tag) : onAdd(t.tag)
                    }
                    aria-pressed={selected}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition",
                      selected
                        ? "border-violet-500 bg-violet-600 text-white"
                        : "border-violet-200 bg-card text-violet-800 hover:border-violet-300 hover:bg-violet-100",
                      disabled && "cursor-not-allowed opacity-40 hover:bg-card",
                    )}
                  >
                    {selected ? (
                      <Check className="h-3 w-3" aria-hidden />
                    ) : (
                      <Plus className="h-3 w-3" aria-hidden />
                    )}
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {atMax && (
        <p className="mt-2 text-[11px] text-violet-700/80">
          タグが上限に達しています。外すと別のタグを追加できます。
        </p>
      )}
    </div>
  );
}

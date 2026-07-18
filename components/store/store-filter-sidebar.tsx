"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { Search } from "lucide-react";
import {
  CURATED_TAG_GROUPS,
  curatedTagsByGroup,
} from "@/lib/format/curated-tags";
import {
  STORE_PRICE_FILTERS,
  type StorePriceFilter,
} from "@/lib/format/price";
import { categoryLabel } from "@/lib/format/category";
import type { ProductType } from "@/lib/queries/types";

/** ジャンル(product_type)の表示順。CategoryDice と同じ。 */
const CATEGORY_ORDER: ProductType[] = [
  "full_package",
  "scenario",
  "rulebook",
  "map",
  "character_art",
  "bgm_audio",
];

/**
 * ランディング右の「絞り込み検索」サイドバー(Re-dice Store.dc.html)。
 * 選んだ条件から既存の /store クエリ(category / tag / price / sale=1)を
 * 組み立てて遷移する URL ビルダー。ストアの絞り込みは単一選択の設計
 * (category=1 つ / tag=1 つ)なので、見た目はデザインのまま挙動は
 * 単一選択(もう一度押すと解除)にしている。
 * 該当件数のライブ表示はダミー値になるため置いていない。
 */
export function StoreFilterSidebar({
  categoryCounts,
}: {
  categoryCounts: Partial<Record<ProductType, number>>;
}) {
  const router = useRouter();
  const [tagQuery, setTagQuery] = useState("");
  const [selTag, setSelTag] = useState<string | null>(null);
  const [selCategory, setSelCategory] = useState<ProductType | null>(null);
  const [price, setPrice] = useState<StorePriceFilter | null>(null);
  const [saleOnly, setSaleOnly] = useState(false);

  const allTags = useMemo(
    () => CURATED_TAG_GROUPS.flatMap((g) => curatedTagsByGroup(g.id)),
    [],
  );
  const shownTags = useMemo(() => {
    const q = tagQuery.trim().toLowerCase();
    if (!q) return allTags;
    return allTags.filter(
      (t) =>
        t.label.toLowerCase().includes(q) || t.tag.toLowerCase().includes(q),
    );
  }, [allTags, tagQuery]);

  function apply() {
    const params = new URLSearchParams();
    if (selCategory) params.set("category", selCategory);
    if (selTag) params.set("tag", selTag);
    if (price) params.set("price", price);
    if (saleOnly) params.set("sale", "1");
    const qs = params.toString();
    router.push((qs ? `/store?${qs}` : "/store") as Route);
  }

  function clearAll() {
    setSelTag(null);
    setSelCategory(null);
    setPrice(null);
    setSaleOnly(false);
    setTagQuery("");
  }

  const hasAny = selTag || selCategory || price || saleOnly;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[#E8DCC5] bg-white p-[18px] shadow-[0_1px_2px_rgba(94,52,24,.06)]">
      <div className="flex items-center gap-2">
        <span className="die-ico" aria-hidden style={{ width: 20, height: 20 }} />
        <h2 className="flex-1 font-serif text-[15px] font-bold">絞り込み検索</h2>
        <button
          type="button"
          onClick={clearAll}
          className="text-[11px] font-bold text-accent transition hover:text-primary"
        >
          クリア
        </button>
      </div>

      {/* タグ */}
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground">
          タグで探す
        </span>
        <div className="flex h-[34px] items-center gap-[7px] rounded-[9px] border border-[#E8DCC5] bg-background px-3">
          <Search className="h-3 w-3 shrink-0 text-[#B02832]" aria-hidden />
          <input
            value={tagQuery}
            onChange={(e) => setTagQuery(e.target.value)}
            placeholder="タグ名で検索"
            className="min-w-0 flex-1 border-none bg-transparent text-xs text-foreground focus:outline-none"
          />
        </div>
        <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
          {shownTags.map((t) => {
            const on = selTag === t.tag;
            return (
              <button
                key={t.tag}
                type="button"
                title={t.tag}
                onClick={() => setSelTag(on ? null : t.tag)}
                className="rounded-full border px-[11px] py-1 text-[11px] font-bold transition"
                style={{
                  borderColor: on ? "#B02832" : "#E8DCC5",
                  background: on ? "#B02832" : "#FAF5EC",
                  color: on ? "#fff" : "#2A1C14",
                }}
              >
                {t.label}
              </button>
            );
          })}
          {shownTags.length === 0 && (
            <span className="text-[11px] text-muted-foreground">
              一致するタグがありません
            </span>
          )}
        </div>
      </div>

      <div className="h-px bg-[#F0E8D8]" />

      {/* ジャンル(単一選択) */}
      <div className="flex flex-col gap-1">
        <span className="mb-1 text-[11px] font-bold tracking-[0.08em] text-muted-foreground">
          ジャンル
        </span>
        {CATEGORY_ORDER.map((c) => {
          const on = selCategory === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setSelCategory(on ? null : c)}
              className="flex w-full items-center gap-2 py-1 text-left"
            >
              <span
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded border-[1.5px] text-[10px] font-extrabold text-white"
                style={{
                  borderColor: on ? "#B02832" : "#D8CBB2",
                  background: on ? "#B02832" : "#fff",
                }}
                aria-hidden
              >
                {on ? "✓" : ""}
              </span>
              <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] font-semibold text-foreground">
                {categoryLabel(c)}
              </span>
              <span className="shrink-0 text-[10.5px] text-muted-foreground">
                {(categoryCounts[c] ?? 0).toLocaleString("ja-JP")}
              </span>
            </button>
          );
        })}
      </div>

      <div className="h-px bg-[#F0E8D8]" />

      {/* 価格 */}
      <div className="flex flex-col gap-1">
        <span className="mb-1 text-[11px] font-bold tracking-[0.08em] text-muted-foreground">
          価格
        </span>
        {[
          { value: null as StorePriceFilter | null, label: "すべて" },
          ...STORE_PRICE_FILTERS.map((f) => ({
            value: f.value as StorePriceFilter | null,
            label: f.label,
          })),
        ].map((p) => {
          const on = price === p.value;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => setPrice(p.value)}
              className="flex w-full items-center gap-2 py-1 text-left"
            >
              <span
                className="flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full border-[1.5px]"
                style={{ borderColor: on ? "#B02832" : "#D8CBB2" }}
                aria-hidden
              >
                <span
                  className="h-[7px] w-[7px] rounded-full"
                  style={{ background: on ? "#B02832" : "transparent" }}
                />
              </span>
              <span className="text-[12.5px] font-semibold text-foreground">
                {p.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="h-px bg-[#F0E8D8]" />

      {/* セール中のみ */}
      <button
        type="button"
        onClick={() => setSaleOnly((v) => !v)}
        className="flex w-full items-center gap-2 text-left"
        aria-pressed={saleOnly}
      >
        <span
          className="relative h-[18px] w-[30px] shrink-0 rounded-full transition-colors"
          style={{ background: saleOnly ? "#159457" : "#D8CBB2" }}
          aria-hidden
        >
          <span
            className="absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.25)] transition-all"
            style={{ left: saleOnly ? 14 : 2 }}
          />
        </span>
        <span className="flex-1 text-[12.5px] font-semibold text-foreground">
          セール中のみ表示
        </span>
        <span className="text-[10px] font-extrabold text-[#159457]">SALE</span>
      </button>

      <button
        type="button"
        onClick={apply}
        disabled={!hasAny}
        className="h-10 rounded-[10px] bg-[#B02832] text-[13px] font-extrabold text-white transition hover:bg-[#93202A] disabled:cursor-not-allowed disabled:opacity-40"
      >
        この条件で絞り込む
      </button>
      <Link
        href={"/store?sort=published" as Route}
        className="text-center text-[11.5px] font-semibold text-accent transition hover:text-primary"
      >
        すべての作品を一覧で見る →
      </Link>
    </div>
  );
}

"use client";

import * as React from "react";
import { Search, X, ArrowDownUp } from "lucide-react";
import { LibraryCard } from "./library-card";
import { categoryLabel } from "@/lib/format/category";
import type { LibraryItem, LibraryAvailability } from "@/lib/queries/library";
import type { ProductType } from "@/lib/queries/types";
import { cn } from "@/lib/utils";

/**
 * ライブラリの検索・絞り込み・並び替え(クライアント)。サーバーが取得済みの
 * items を受け取り、端末側で:
 *   - キーワード検索(タイトル / 作者名)
 *   - カテゴリ絞り込み(ライブラリに実在する種別だけチップ表示)
 *   - 状態絞り込み(利用可能 / 準備中 / 配布停止中 …、実在する状態だけ)
 *   - 並び替え(購入日 / タイトル / 価格)
 * を行う。購入数が増えても目的の作品に辿り着けるようにするのが狙い。
 *
 * 集計タイル(購入総額など)は全件に対する値なのでサーバー側に残し、ここは
 * 一覧の絞り込みだけを担当する。
 */

type SortKey = "recent" | "oldest" | "title" | "price_high" | "price_low";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recent", label: "購入日が新しい順" },
  { value: "oldest", label: "購入日が古い順" },
  { value: "title", label: "タイトル順" },
  { value: "price_high", label: "価格が高い順" },
  { value: "price_low", label: "価格が安い順" },
];

const STATUS_LABEL: Record<LibraryAvailability, string> = {
  available: "利用可能",
  no_file: "準備中",
  suspended: "配布停止中",
  blocked: "利用不可",
};

// 状態チップの表示順(実在するものだけ出す)。
const STATUS_ORDER: LibraryAvailability[] = [
  "available",
  "no_file",
  "suspended",
  "blocked",
];

export function LibraryBrowser({ items }: { items: LibraryItem[] }) {
  const [q, setQ] = React.useState("");
  const [category, setCategory] = React.useState<ProductType | "all">("all");
  const [status, setStatus] = React.useState<LibraryAvailability | "all">("all");
  const [sort, setSort] = React.useState<SortKey>("recent");

  // ライブラリに実在するカテゴリ / 状態だけをチップに出す(無関係な選択肢を
  // 並べない)。出現順は商品種別の定義順ではなく items 内の登場順で十分。
  const categoriesPresent = React.useMemo(() => {
    const set = new Set<ProductType>();
    for (const it of items) set.add(it.productType);
    return Array.from(set);
  }, [items]);

  const statusesPresent = React.useMemo(() => {
    const set = new Set<LibraryAvailability>();
    for (const it of items) set.add(it.availability);
    return STATUS_ORDER.filter((s) => set.has(s));
  }, [items]);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = items.filter((it) => {
      if (category !== "all" && it.productType !== category) return false;
      if (status !== "all" && it.availability !== status) return false;
      if (needle) {
        const hay = `${it.title} ${it.creator.displayName}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });

    const sorted = [...list];
    switch (sort) {
      case "recent":
        sorted.sort((a, b) => b.paidAt.localeCompare(a.paidAt));
        break;
      case "oldest":
        sorted.sort((a, b) => a.paidAt.localeCompare(b.paidAt));
        break;
      case "title":
        sorted.sort((a, b) => a.title.localeCompare(b.title, "ja"));
        break;
      case "price_high":
        sorted.sort((a, b) => b.amountJpy - a.amountJpy);
        break;
      case "price_low":
        sorted.sort((a, b) => a.amountJpy - b.amountJpy);
        break;
    }
    return sorted;
  }, [items, q, category, status, sort]);

  const hasFilter = q.trim() !== "" || category !== "all" || status !== "all";

  function reset() {
    setQ("");
    setCategory("all");
    setStatus("all");
  }

  return (
    <div className="space-y-4">
      {/* 検索バー + 並び替え */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="作品名・作者名で検索"
            aria-label="ライブラリ内を検索"
            className="w-full rounded-md border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none transition focus:border-foreground/30 focus:ring-2 focus:ring-ring"
          />
        </div>
        <label className="flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1.5 text-sm">
          <ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <span className="sr-only">並び替え</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="bg-transparent text-sm outline-none"
            aria-label="並び替え"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* カテゴリ / 状態 チップ(実在するものだけ) */}
      {(categoriesPresent.length > 1 || statusesPresent.length > 1) && (
        <div className="flex flex-col gap-2">
          {categoriesPresent.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                種別
              </span>
              <FilterChip
                active={category === "all"}
                onClick={() => setCategory("all")}
              >
                すべて
              </FilterChip>
              {categoriesPresent.map((c) => (
                <FilterChip
                  key={c}
                  active={category === c}
                  onClick={() => setCategory(c)}
                >
                  {categoryLabel(c)}
                </FilterChip>
              ))}
            </div>
          )}
          {statusesPresent.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                状態
              </span>
              <FilterChip
                active={status === "all"}
                onClick={() => setStatus("all")}
              >
                すべて
              </FilterChip>
              {statusesPresent.map((s) => (
                <FilterChip
                  key={s}
                  active={status === s}
                  onClick={() => setStatus(s)}
                >
                  {STATUS_LABEL[s]}
                </FilterChip>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 件数 + フィルタ解除 */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {filtered.length} 件
          {hasFilter && ` / 全 ${items.length} 件`}
        </span>
        {hasFilter && (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 transition hover:border-foreground/30 hover:text-foreground"
          >
            <X className="h-3 w-3" aria-hidden />
            条件をクリア
          </button>
        )}
      </div>

      {/* 一覧 or 絞り込み 0 件 */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-10 text-center">
          <p className="text-sm font-medium">条件に一致する作品がありません</p>
          <p className="mt-1 text-xs text-muted-foreground">
            キーワードや絞り込みを変えてみてください。
          </p>
          {hasFilter && (
            <button
              type="button"
              onClick={reset}
              className="mt-3 inline-flex items-center gap-1 rounded-md border border-border px-3 py-1 text-xs transition hover:border-foreground/30 hover:text-foreground"
            >
              <X className="h-3 w-3" aria-hidden />
              条件をクリア
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((item) => (
            <LibraryCard key={item.purchaseId} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

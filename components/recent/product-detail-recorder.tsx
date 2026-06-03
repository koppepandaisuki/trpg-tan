"use client";

import { useEffect } from "react";
import { useRecordView, type RecentViewItem } from "@/hooks/use-recent-views";

/**
 * 商品詳細ページに mount するだけの client-only コンポーネント。
 * mount 時に「最近見た作品」の localStorage に 1 件追記する。
 *
 * 表示は何もしない(record 用 side effect のみ)。Server Component の
 * 商品詳細ページから渡された商品情報を localStorage に書き込む。
 *
 * 同じページの再レンダリングで重複追加しないよう、依存配列は slug 単独
 * (props の他フィールドが変わっても、同じ slug なら重複扱い → 先頭に
 *  移動するだけ)。
 */
export function ProductDetailRecorder({
  item,
}: {
  item: Omit<RecentViewItem, "viewedAt">;
}) {
  const recordView = useRecordView();

  useEffect(() => {
    recordView(item);
    // slug が同じなら同じ商品とみなし、refresh しても重複追加にならない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.slug]);

  return null;
}

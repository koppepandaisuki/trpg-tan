"use client";

import { useState, Children } from "react";
import { ChevronDown } from "lucide-react";

/**
 * レビュー一覧を「最初の N 件のみ表示 + もっと見る」で折りたたむ
 * client ラッパー(YYYYY)。
 *
 * 各レビュー card は Server Component(ReviewSection)側で生成して
 * children として渡す。この component は表示件数の state だけを持ち、
 * children を slice して描画する。
 *
 * children が initialCount 以下なら「もっと見る」ボタンは出さず、
 * 全件そのまま表示する。
 */
interface CollapsibleReviewListProps {
  children: React.ReactNode;
  /** 初期表示件数(デフォルト 3)*/
  initialCount?: number;
}

export function CollapsibleReviewList({
  children,
  initialCount = 3,
}: CollapsibleReviewListProps) {
  const [expanded, setExpanded] = useState(false);
  const all = Children.toArray(children);
  const total = all.length;

  // 折りたたみ不要(全件が初期表示内)
  if (total <= initialCount) {
    return <ul className="space-y-3">{children}</ul>;
  }

  const visible = expanded ? all : all.slice(0, initialCount);
  const hiddenCount = total - initialCount;

  return (
    <div className="space-y-3">
      <ul className="space-y-3">{visible}</ul>
      {!expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-card py-2.5 text-sm font-medium text-muted-foreground transition hover:border-foreground/30 hover:text-foreground"
        >
          残り {hiddenCount} 件のレビューを見る
          <ChevronDown className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

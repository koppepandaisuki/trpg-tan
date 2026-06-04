"use client";

import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useIsFavorited,
  useToggleFavorite,
  type FavoriteItem,
} from "@/hooks/use-favorites";
import { cn } from "@/lib/utils";

/**
 * 商品詳細の「お気に入り」トグルボタン。Heart icon が状態で塗りつぶされる。
 *
 * 仕様:
 *  - クリックで toggle、結果に応じて見た目が切替
 *  - on のときは rose tone で fill、off のときは outline
 *  - hover で軽く scale
 *  - sr-only テキストで現在の状態を screen reader に伝える
 *
 * Server で渡される item は表示用の最小限フィールド(coverUrl は解決済)。
 * Recently viewed の recorder と同じ shape を共有できる(coverUrl 解決
 * の方針が同じ)。
 */
interface FavoriteButtonProps {
  item: Omit<FavoriteItem, "favoritedAt">;
  /** ボタンの見た目バリアント。デフォルト = solid outline、compact = icon only */
  variant?: "default" | "compact";
  className?: string;
}

export function FavoriteButton({
  item,
  variant = "default",
  className,
}: FavoriteButtonProps) {
  const isFavorited = useIsFavorited(item.slug);
  const toggle = useToggleFavorite();

  function onClick() {
    toggle(item);
  }

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={isFavorited}
        aria-label={
          isFavorited ? "お気に入りから外す" : "お気に入りに追加"
        }
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-md border transition-all",
          isFavorited
            ? "border-rose-300 bg-rose-50 text-rose-600 hover:bg-rose-100"
            : "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground",
          "active:scale-95",
          className,
        )}
      >
        <Heart
          className={cn("h-4 w-4 transition-transform", isFavorited && "fill-current")}
          aria-hidden
        />
      </button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      aria-pressed={isFavorited}
      className={cn(
        "transition-all active:scale-95",
        isFavorited
          ? "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
          : "",
        className,
      )}
    >
      <Heart
        className={cn("h-4 w-4 transition-transform", isFavorited && "fill-current")}
        aria-hidden
      />
      {isFavorited ? "お気に入り済" : "お気に入りに追加"}
    </Button>
  );
}

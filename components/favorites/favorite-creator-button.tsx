"use client";

import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useIsCreatorFavorited,
  useToggleFavoriteCreator,
  type FavoriteCreatorItem,
} from "@/hooks/use-favorite-creators";
import { cn } from "@/lib/utils";

/**
 * クリエイタープロフィール用の「お気に入り」トグルボタン(VVVV)。
 * 作品用 FavoriteButton と同じ触感だが、creator を保存する。
 *
 * server から渡される creator は表示用最小フィールド(avatarUrl 解決済)。
 */
interface FavoriteCreatorButtonProps {
  creator: Omit<FavoriteCreatorItem, "favoritedAt">;
  className?: string;
}

export function FavoriteCreatorButton({
  creator,
  className,
}: FavoriteCreatorButtonProps) {
  const isFavorited = useIsCreatorFavorited(creator.id);
  const toggle = useToggleFavoriteCreator();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => toggle(creator)}
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
      {isFavorited ? "お気に入り登録済" : "お気に入り登録"}
    </Button>
  );
}

"use client";

import { useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

/**
 * TopHeader / MobileMenu の商品検索バー(IIIII)。
 *
 * 動作:
 *  - Enter または submit で /store?q=<input> に遷移
 *  - 既に /store にいる場合は既存の category / tag / sort を維持しつつ
 *    q だけ差し替える(URLSearchParams をマージ)
 *  - 空入力で submit したら q を削除して /store(全件)へ
 *
 * defaultValue は現在の URL の q を反映(検索後にバーに残す)。
 *
 * Client Component。useRouter / useSearchParams が必要。
 */
interface SearchBarProps {
  /** mobile menu から呼ぶときに submit 後にメニューを閉じる等のフック */
  onSubmitted?: () => void;
  /** プレースホルダの上書き(モバイル等)*/
  placeholder?: string;
  autoFocus?: boolean;
}

export function SearchBar({
  onSubmitted,
  placeholder = "作品名・作者・タグで検索…",
  autoFocus,
}: SearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  const currentQ = searchParams.get("q") ?? "";

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = inputRef.current?.value.trim() ?? "";

    // 既存の検索パラメータ(category / tag / sort)を維持して q を差替。
    // ただし検索したら page はリセット(1 ページ目に戻す = page を削除)。
    const params = new URLSearchParams();
    const category = searchParams.get("category");
    const tag = searchParams.get("tag");
    const sort = searchParams.get("sort");
    if (category) params.set("category", category);
    if (tag) params.set("tag", tag);
    if (sort) params.set("sort", sort);
    if (value) params.set("q", value);

    const qs = params.toString();
    router.push(qs ? `/store?${qs}` : "/store");
    onSubmitted?.();
  }

  return (
    <form onSubmit={onSubmit} role="search" className="relative w-full">
      <Search
        className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        ref={inputRef}
        type="search"
        name="q"
        defaultValue={currentQ}
        placeholder={placeholder}
        className="pl-9"
        aria-label="作品名・作者・タグで検索"
        autoFocus={autoFocus}
        maxLength={100}
      />
    </form>
  );
}

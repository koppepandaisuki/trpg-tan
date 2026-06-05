"use client";

import { useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

/**
 * /creators ページの検索バー(OOOOO)。クリエイター名(display_name)で
 * 部分一致検索する。submit で /creators?q=... に遷移し、既存の sort は
 * 維持(page はリセット)。
 *
 * Client Component。
 */
export function CreatorSearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const currentQ = searchParams.get("q") ?? "";

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = inputRef.current?.value.trim() ?? "";

    const params = new URLSearchParams();
    const sort = searchParams.get("sort");
    if (sort) params.set("sort", sort);
    if (value) params.set("q", value);

    const qs = params.toString();
    router.push(qs ? `/creators?${qs}` : "/creators");
  }

  return (
    <form onSubmit={onSubmit} role="search" className="relative max-w-md">
      <Search
        className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        ref={inputRef}
        type="search"
        name="q"
        defaultValue={currentQ}
        placeholder="クリエイター名で検索…"
        className="pl-9"
        aria-label="クリエイター名で検索"
        maxLength={50}
      />
    </form>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** 参加コードの入力ゆれをならす(小文字・空白・全角英数)。 */
export function normalizeJoinCode(raw: string): string {
  return raw
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\s/g, "")
    .toUpperCase();
}

/**
 * 参加コードで卓に入るフォーム(参加者の入口)。トップのヒーローと PLAY ロビーで共通。
 *   - hero : 暗い面の上に 1 行(入力 + 参加する)
 *   - panel: カードの中に縦積み
 */
export function JoinCodeForm({ variant = "panel" }: { variant?: "hero" | "panel" }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const ready = code.length >= 4;

  function join() {
    if (!ready) return;
    router.push(`/play/join/${encodeURIComponent(code)}`);
  }

  const hero = variant === "hero";
  return (
    <form
      className={cn(hero ? "flex gap-2" : "space-y-2")}
      onSubmit={(e) => {
        e.preventDefault();
        join();
      }}
    >
      <input
        value={code}
        onChange={(e) => setCode(normalizeJoinCode(e.target.value))}
        maxLength={8}
        placeholder="参加コード"
        aria-label="参加コード"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        className={cn(
          "h-12 min-w-0 rounded-full px-5 font-mono text-lg tracking-[0.3em] transition-colors",
          "placeholder:font-sans placeholder:text-sm placeholder:tracking-normal focus:outline-none",
          hero
            ? "flex-1 border border-white/25 bg-white/10 text-white placeholder:text-white/50 hover:border-white/40 focus:border-white focus:ring-4 focus:ring-white/15"
            : "w-full border border-border bg-card text-center hover:border-foreground/25 focus:border-ink focus:ring-4 focus:ring-ink/10",
        )}
      />
      <Button
        type="submit"
        size="lg"
        variant={hero ? "outline" : "ink"}
        disabled={!ready}
        className={cn(
          hero && "border-transparent bg-white text-ink hover:border-transparent hover:bg-white/90",
          !hero && "w-full",
        )}
      >
        <LogIn aria-hidden />
        参加する
      </Button>
    </form>
  );
}

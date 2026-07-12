"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { UserCheck, User as UserIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getMyFollowingAction } from "@/app/(public)/creator/[id]/follow-actions";
import type { FollowingCreatorCard } from "@/lib/queries/creator-follow";

/**
 * 「フォロー中のクリエイター」strip(ホーム)。お気に入り(localStorage)
 * の置き換えで、DB の creator_follows 由来。ホームは ISR キャッシュなので
 * ユーザー個別のこの section はクライアントで server action 取得する。
 * 0 件 / 未ログインなら描画なし。
 */
export function FollowingCreatorsSection() {
  const [items, setItems] = useState<FollowingCreatorCard[] | null>(null);

  useEffect(() => {
    let alive = true;
    getMyFollowingAction()
      .then((r) => {
        if (alive) setItems(r);
      })
      .catch(() => {
        if (alive) setItems([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!items || items.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600">
          <UserCheck className="h-4 w-4" aria-hidden />
        </div>
        <div className="space-y-0.5">
          <h2 className="text-lg font-semibold tracking-tight">
            フォロー中のクリエイター
          </h2>
          <p className="text-xs text-muted-foreground">
            あなたがフォローしているクリエイター
          </p>
        </div>
      </div>

      <div className="-mx-4 sm:-mx-6">
        <ul
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 sm:px-6"
          style={{ scrollbarWidth: "thin" }}
        >
          {items.map((it) => (
            <li key={it.id} className="w-[140px] shrink-0 snap-start">
              <Link
                href={`/creator/${it.id}` as Route}
                className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label={`${it.displayName || "クリエイター"} のプロフィールを見る`}
              >
                <Card className="overflow-hidden border-border shadow-sm transition-all group-hover:border-foreground/20 group-hover:shadow-card">
                  <CardContent className="flex flex-col items-center gap-2 py-4 text-center">
                    <div className="h-16 w-16 overflow-hidden rounded-full border border-border bg-muted">
                      {it.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={it.avatarUrl}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <UserIcon className="h-7 w-7" aria-hidden />
                        </div>
                      )}
                    </div>
                    <p className="line-clamp-1 w-full text-sm font-medium tracking-tight transition-colors group-hover:text-accent">
                      {it.displayName || "(名称未設定)"}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

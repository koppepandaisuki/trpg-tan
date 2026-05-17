import Link from "next/link";
import { TopHeader } from "@/components/layout/top-header";
import { SidebarLayout } from "@/components/layout/sidebar-layout";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const CREATOR_NAV = [
  { label: "ダッシュボード", href: "/creator/products" },
  { label: "作品管理", href: "/creator/products", current: true },
  { label: "売上・分析", href: "/creator/products" },
  { label: "設定", href: "/creator/products" },
];

export default function CreatorProductsPage() {
  return (
    <>
      <TopHeader />
      <SidebarLayout
        sidebar={
          <nav className="space-y-1 rounded-lg border border-border bg-card p-2">
            <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              クリエイターメニュー
            </p>
            {CREATOR_NAV.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={
                  "block rounded-md px-3 py-2 text-sm " +
                  (item.current
                    ? "bg-foreground/5 font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground")
                }
              >
                {item.label}
              </Link>
            ))}
          </nav>
        }
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">作品管理</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              自分の作品一覧(Phase 5 で実装)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="muted">P5</Badge>
            <Link href="/creator/products/new" className={cn(buttonVariants())}>
              新しい作品を登録
            </Link>
          </div>
        </div>

        <Card className="mt-6 shadow-sm">
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            まだ作品がありません。
            <br />
            「新しい作品を登録」からビルダーを開けます(プレースホルダー画面)。
          </CardContent>
        </Card>
      </SidebarLayout>
    </>
  );
}

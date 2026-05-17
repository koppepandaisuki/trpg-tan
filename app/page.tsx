import Link from "next/link";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ROUTES = [
  { href: "/store", label: "ストア一覧", description: "公開作品をブラウズ", phase: "P4" },
  { href: "/store/sample-slug", label: "作品詳細(サンプル)", description: "メタ情報・購入導線", phase: "P4" },
  { href: "/library", label: "ライブラリ", description: "購入済み作品(認証必須)", phase: "P6" },
  { href: "/creator/products", label: "作品管理", description: "クリエイター用一覧", phase: "P5" },
  { href: "/creator/products/new", label: "新規作成ビルダー", description: "作品の登録フォーム", phase: "P5" },
  { href: "/admin", label: "admin", description: "運営管理(admin専用)", phase: "P8" },
];

export default function HomePage() {
  return (
    <>
      <TopHeader />
      <PageContainer className="py-10">
        <div className="flex flex-col gap-3">
          <Badge variant="muted" className="self-start">Phase 1 — 土台</Badge>
          <h1 className="text-2xl font-semibold tracking-tight">TRPG プラットフォーム</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            このページは Phase 1(プロジェクト土台)のプレースホルダーです。
            各画面の入り口だけが用意されており、業務ロジックは後続フェーズで実装します。
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ROUTES.map((r) => (
            <Card key={r.href} className="shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>{r.label}</CardTitle>
                  <Badge variant="category">{r.phase}</Badge>
                </div>
                <CardDescription>{r.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link
                  href={r.href}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  {r.href}
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </PageContainer>
    </>
  );
}

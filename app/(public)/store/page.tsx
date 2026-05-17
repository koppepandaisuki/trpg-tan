import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const CATEGORIES = [
  "すべて",
  "シナリオ",
  "ルールブック",
  "マップ・バトルマップ",
  "アートワーク",
  "BGM・効果音",
  "その他素材",
];

const PLACEHOLDER_CARDS = Array.from({ length: 8 });

export default function StorePage() {
  return (
    <>
      <TopHeader />
      <PageContainer className="py-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">ストア</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              公開中のTRPG作品を探す(Phase 4 で実装)
            </p>
          </div>
          <Badge variant="muted">プレースホルダー / P4</Badge>
        </div>

        <nav className="mt-6 flex flex-wrap gap-2 border-b border-border pb-2">
          {CATEGORIES.map((c, i) => (
            <button
              key={c}
              disabled
              className={
                "rounded-md px-3 py-1.5 text-sm " +
                (i === 0
                  ? "bg-foreground/5 font-medium text-foreground"
                  : "text-muted-foreground")
              }
            >
              {c}
            </button>
          ))}
        </nav>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {PLACEHOLDER_CARDS.map((_, i) => (
            <Card key={i} className="overflow-hidden shadow-sm">
              <div className="aspect-[16/10] w-full bg-muted" aria-hidden />
              <CardContent className="space-y-2 p-4">
                <Badge variant="category">カテゴリ</Badge>
                <p className="text-sm font-medium">作品タイトル(ダミー)</p>
                <p className="text-xs text-muted-foreground">対応システム</p>
                <p className="text-sm font-semibold">¥—</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </PageContainer>
    </>
  );
}

import { TopHeader } from "@/components/layout/top-header";
import { ThreeColumn } from "@/components/layout/three-column";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface PageProps {
  params: { slug: string };
}

const META_ROWS: { label: string; value: string }[] = [
  { label: "対応システム", value: "—" },
  { label: "プレイ人数", value: "—" },
  { label: "プレイ時間", value: "—" },
  { label: "推奨技能", value: "—" },
  { label: "形式", value: "PDF" },
  { label: "更新日", value: "—" },
];

export default function WorkDetailPage({ params }: PageProps) {
  return (
    <>
      <TopHeader />
      <ThreeColumn
        right={
          <div className="flex flex-col gap-4">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>購入オプション</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-2xl font-semibold">¥—</div>
                <Button className="w-full" disabled>
                  今すぐ購入(P7)
                </Button>
                <Button variant="outline" className="w-full" disabled>
                  サンプルを見る
                </Button>
                <ul className="space-y-1 pt-2 text-xs text-muted-foreground">
                  <li>ダウンロード商品</li>
                  <li>購入後すぐにダウンロード可能</li>
                  <li>形式・利用条件は詳細を参照</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>作者について</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  作者プロフィール(Phase 5以降で表示)
                </p>
              </CardContent>
            </Card>
          </div>
        }
      >
        <nav className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>ホーム</span>
          <span>›</span>
          <span>ストア</span>
          <span>›</span>
          <span className="text-foreground">{params.slug}</span>
        </nav>

        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">作品タイトル(プレースホルダー)</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              slug: <code className="rounded bg-muted px-1 py-0.5">{params.slug}</code>
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge variant="category">シナリオ</Badge>
              <Badge variant="muted">タグ1</Badge>
              <Badge variant="muted">タグ2</Badge>
            </div>
          </div>
          <Badge variant="muted">P4</Badge>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="aspect-[16/10] w-full rounded-lg bg-muted" aria-hidden />
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <dl className="divide-y divide-border">
                {META_ROWS.map((r) => (
                  <div key={r.label} className="flex justify-between py-2 text-sm">
                    <dt className="text-muted-foreground">{r.label}</dt>
                    <dd>{r.value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </div>

        <section className="mt-8 space-y-3">
          <h2 className="text-lg font-semibold">作品の説明</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            ここに作品の本文・あらすじが入ります。Phase 4 でDBから取得します。
          </p>
        </section>
      </ThreeColumn>
    </>
  );
}

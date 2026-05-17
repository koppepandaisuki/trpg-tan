import { TopHeader } from "@/components/layout/top-header";
import { ThreeColumn } from "@/components/layout/three-column";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const BUILDER_TREE = [
  "概要",
  "基本情報",
  "本文・詳細",
  "タグ・カテゴリ",
  "価格設定",
  "公開設定",
  "ファイル添付",
];

export default function NewProductBuilderPage() {
  return (
    <>
      <TopHeader />
      <div className="border-b border-border bg-background">
        <div className="mx-auto flex h-14 w-full max-w-screen-2xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">TRPGコンテンツを作成</span>
            <Badge variant="muted">P5</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled>下書き保存</Button>
            <Button variant="outline" size="sm" disabled>プレビュー</Button>
            <Button variant="outline" size="sm" disabled>公開設定</Button>
            <Button size="sm" disabled>作品を作成</Button>
          </div>
        </div>
      </div>

      <ThreeColumn
        left={
          <nav className="space-y-1 rounded-lg border border-border bg-card p-2">
            <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              コンテンツツリー
            </p>
            {BUILDER_TREE.map((s, i) => (
              <button
                key={s}
                disabled
                className={
                  "block w-full rounded-md px-3 py-2 text-left text-sm " +
                  (i === 0
                    ? "bg-foreground/5 font-medium text-foreground"
                    : "text-muted-foreground")
                }
              >
                {i > 0 && <span className="mr-2 text-xs">{i}</span>}
                {s}
              </button>
            ))}
          </nav>
        }
        right={
          <div className="space-y-4">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>プレビュー</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-[16/10] w-full rounded-md bg-muted" aria-hidden />
                <p className="mt-3 text-sm text-muted-foreground">
                  入力内容のライブプレビュー(Phase 5)
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>公開ステータス</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant="muted">下書き</Badge>
                <p className="mt-2 text-xs text-muted-foreground">
                  まだ公開されていません
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>入力チェック</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p className="text-muted-foreground">必須項目を入力してください</p>
                <p className="text-muted-foreground">推奨項目の入力を検討してください</p>
              </CardContent>
            </Card>
          </div>
        }
      >
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>概要</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>このページは Phase 5 で実装するビルダーUIの骨組みプレースホルダーです。</p>
            <p>実装される入力フィールド: タイトル / 種類カード選択 / 説明 / カテゴリ / 対応システム / タグ / 価格 / ファイル形式 / 表紙画像。</p>
            <p>react-hook-form + zod、Server Actionによる自動保存(2秒 debounce)を予定。</p>
          </CardContent>
        </Card>
      </ThreeColumn>
    </>
  );
}

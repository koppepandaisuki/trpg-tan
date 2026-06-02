import { ShoppingBag } from "lucide-react";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { EmptyState } from "@/components/store/empty-state";
import { LibraryCard } from "@/components/library/library-card";
import { requireUser } from "@/lib/session/require";
import { listMyLibrary, type LibraryItem } from "@/lib/queries/library";

export const metadata = { title: "ライブラリ | TRPG プラットフォーム" };

export default async function LibraryPage() {
  const user = await requireUser();
  const items = await listMyLibrary(user.id);

  const available = items.filter((i) => i.availability === "available");
  const pending = items.filter((i) => i.availability === "no_file");
  const suspended = items.filter(
    (i) => i.availability === "suspended" || i.availability === "blocked",
  );

  return (
    <>
      <TopHeader />
      <PageContainer className="py-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">ライブラリ</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              購入済みの作品 {items.length} 件
            </p>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={ShoppingBag}
              title="購入済みの作品はまだありません"
              description="ストアからお気に入りの作品を見つけて購入すると、ここに表示されます。テスト購入はテストカード 4242 4242 4242 4242 で行えます。"
              primaryAction={{ href: "/store", label: "ストアを見る" }}
              secondaryAction={{ href: "/", label: "ホームに戻る" }}
            />
          </div>
        ) : (
          <div className="mt-6 space-y-8">
            {available.length > 0 && (
              <Section title="利用可能" items={available} />
            )}
            {pending.length > 0 && <Section title="準備中" items={pending} />}
            {suspended.length > 0 && (
              <Section title="配布停止中" items={suspended} />
            )}
          </div>
        )}
      </PageContainer>
    </>
  );
}

function Section({ title, items }: { title: string; items: LibraryItem[] }) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      <ul className="space-y-3">
        {items.map((item) => (
          <LibraryCard key={item.purchaseId} item={item} />
        ))}
      </ul>
    </div>
  );
}

import Link from "next/link";
import type { Route } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminTopPage() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <NavCard
        href="/admin/users"
        title="ユーザー"
        description="creator 権限の付与・剥奪を管理します。"
      />
      <NavCard
        href="/admin/products"
        title="作品"
        description="作品の停止・公開復帰・下書き化を行います。"
      />
      <NavCard
        href="/admin/orders"
        title="取引"
        description="購入履歴を確認し、必要に応じて Stripe Dashboard で返金処理します。"
      />
    </div>
  );
}

function NavCard({
  href,
  title,
  description,
}: {
  href: Route;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className="group block focus-visible:outline-none">
      <Card className="h-full shadow-sm transition-shadow group-hover:shadow-card">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

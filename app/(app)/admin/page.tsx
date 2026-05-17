import { TopHeader } from "@/components/layout/top-header";
import { SidebarLayout } from "@/components/layout/sidebar-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const ADMIN_NAV = [
  { label: "ダッシュボード", current: true },
  { label: "ユーザー" },
  { label: "作品" },
  { label: "取引" },
];

export default function AdminPage() {
  return (
    <>
      <TopHeader />
      <SidebarLayout
        sidebar={
          <nav className="space-y-1 rounded-lg border border-border bg-card p-2">
            <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              admin メニュー
            </p>
            {ADMIN_NAV.map((item) => (
              <span
                key={item.label}
                className={
                  "block rounded-md px-3 py-2 text-sm " +
                  (item.current
                    ? "bg-foreground/5 font-medium text-foreground"
                    : "text-muted-foreground")
                }
              >
                {item.label}
              </span>
            ))}
          </nav>
        }
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">admin ダッシュボード</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              運営向け管理画面(Phase 8 で実装、認証/権限は Phase 3)
            </p>
          </div>
          <Badge variant="muted">P8</Badge>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {["ユーザー数", "公開作品数", "累計売上"].map((label) => (
            <Card key={label} className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">—</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </SidebarLayout>
    </>
  );
}

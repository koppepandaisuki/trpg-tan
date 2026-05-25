"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { statusLabel, statusBadgeVariant, type ProductStatus } from "@/lib/format/status";
import { categoryLabel } from "@/lib/format/category";
import { formatPrice } from "@/lib/format/price";
import type { BuilderFormValues } from "@/lib/validators/product";

interface SidebarInfoProps {
  status: ProductStatus;
  publishedAt: string | null;
  preview: BuilderFormValues;
  savedAt: Date | null;
  requiredMissingCount: number;
  recommendedMissingCount: number;
}

/**
 * Right rail: live preview card, publish status, save state, input check.
 *
 * Save state is manual (not autosave). `savedAt` is set by the parent after
 * a Server Action returns ok.
 */
export function SidebarInfo({
  status,
  publishedAt,
  preview,
  savedAt,
  requiredMissingCount,
  recommendedMissingCount,
}: SidebarInfoProps) {
  return (
    <div className="flex flex-col gap-4">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>プレビュー</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="aspect-[16/10] w-full rounded-md bg-muted" aria-hidden />
          <Badge variant="category">{categoryLabel(preview.productType)}</Badge>
          <p className="text-sm font-medium leading-snug">
            {preview.title || "タイトル未入力"}
          </p>
          <p className="text-sm font-semibold">{formatPrice(preview.priceJpy ?? 0)}</p>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>公開ステータス</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Badge variant={statusBadgeVariant(status)}>{statusLabel(status)}</Badge>
          {status === "published" && publishedAt && (
            <p className="text-xs text-muted-foreground">
              公開日: {formatDate(publishedAt)}
            </p>
          )}
          {status === "draft" && (
            <p className="text-xs text-muted-foreground">
              「公開して保存」でストアに掲載されます。
            </p>
          )}
          {status === "suspended" && (
            <p className="text-xs text-muted-foreground">
              運営により停止中です。お問い合わせください。
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>保存状態</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {savedAt ? (
            <p className="text-muted-foreground">
              {formatTime(savedAt)} に保存しました
            </p>
          ) : (
            <p className="text-muted-foreground">未保存の変更があります</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            自動保存は Phase 5 では未実装です。
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>入力チェック</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          <CheckLine
            count={requiredMissingCount}
            label="必須項目"
            tone={requiredMissingCount > 0 ? "warn" : "ok"}
          />
          <CheckLine
            count={recommendedMissingCount}
            label="推奨項目"
            tone={recommendedMissingCount > 0 ? "info" : "ok"}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function CheckLine({
  count,
  label,
  tone,
}: {
  count: number;
  label: string;
  tone: "ok" | "warn" | "info";
}) {
  const dotColor =
    tone === "ok"
      ? "bg-emerald-500"
      : tone === "warn"
        ? "bg-destructive"
        : "bg-amber-500";
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-muted-foreground">
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotColor}`} aria-hidden />
        {label}
      </span>
      <span className="font-medium">{count} 件</span>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatTime(d: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(d);
}

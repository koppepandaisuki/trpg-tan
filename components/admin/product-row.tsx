"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { setProductStatusAction } from "@/app/(app)/admin/products/actions";
import { categoryLabel } from "@/lib/format/category";
import { formatPrice } from "@/lib/format/price";
import { statusBadgeVariant, statusLabel } from "@/lib/format/status";
import type { ProductStatus } from "@/lib/format/status";
import type { AdminProductRow } from "@/lib/queries/admin";

interface ProductRowProps {
  product: AdminProductRow;
}

export function AdminProductRowCard({ product }: ProductRowProps) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function setStatus(next: ProductStatus) {
    setError(null);
    startTransition(async () => {
      const result = await setProductStatusAction(product.id, next);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 shadow-sm sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusBadgeVariant(product.status)}>
            {statusLabel(product.status)}
          </Badge>
          <Badge variant="muted">{categoryLabel(product.productType)}</Badge>
        </div>
        <p className="mt-1 truncate text-sm font-medium">
          <Link
            href={`/store/${product.id}`}
            className="hover:underline"
            aria-label={`「${product.title}」の詳細を確認`}
          >
            {product.title}
          </Link>
        </p>
        <p className="text-xs text-muted-foreground">
          作者: {product.creatorName || `${product.creatorId.slice(0, 8)}…`} ·{" "}
          {formatPrice(product.priceJpy)} · 更新 {formatDate(product.updatedAt)}
        </p>
        {error && (
          <p role="alert" className="mt-1 text-xs text-destructive">
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Actions
          status={product.status}
          pending={pending}
          onChange={setStatus}
        />
      </div>
    </li>
  );
}

function Actions({
  status,
  pending,
  onChange,
}: {
  status: ProductStatus;
  pending: boolean;
  onChange: (s: ProductStatus) => void;
}) {
  // ユーザー指示通り、ボタンは「停止 / 公開に戻す / 下書きに戻す」のみ。
  if (status === "published" || status === "draft") {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => onChange("suspended")}
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        停止する
      </Button>
    );
  }
  // status === 'suspended'
  return (
    <>
      <Button
        type="button"
        variant="primary"
        size="sm"
        disabled={pending}
        onClick={() => onChange("published")}
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        公開に戻す
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => onChange("draft")}
      >
        下書きに戻す
      </Button>
    </>
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

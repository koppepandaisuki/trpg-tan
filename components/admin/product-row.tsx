"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, Check, X, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  setProductStatusAction,
  reviewProductAction,
} from "@/app/(app)/admin/products/actions";
import { categoryLabel } from "@/lib/format/category";
import { formatPrice } from "@/lib/format/price";
import { statusBadgeVariant, statusLabel } from "@/lib/format/status";
import type { ProductStatus } from "@/lib/format/status";
import {
  AI_VERDICT_LABEL,
  aiVerdictBadgeVariant,
} from "@/lib/moderation/verdict";
import type { AdminProductRow } from "@/lib/queries/admin";

interface ProductRowProps {
  product: AdminProductRow;
}

export function AdminProductRowCard({ product }: ProductRowProps) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [rejecting, setRejecting] = React.useState(false);
  const [reason, setReason] = React.useState("");

  function setStatus(next: ProductStatus) {
    setError(null);
    startTransition(async () => {
      const result = await setProductStatusAction(product.id, next);
      if (!result.ok) setError(result.message);
    });
  }

  function approve() {
    setError(null);
    startTransition(async () => {
      const result = await reviewProductAction(product.id, true);
      if (!result.ok) setError(result.message);
    });
  }

  function reject() {
    setError(null);
    startTransition(async () => {
      const result = await reviewProductAction(product.id, false, reason);
      if (!result.ok) {
        setError(result.message);
      } else {
        setRejecting(false);
        setReason("");
      }
    });
  }

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusBadgeVariant(product.status)}>
              {statusLabel(product.status)}
            </Badge>
            <Badge variant="muted">{categoryLabel(product.productType)}</Badge>
            {product.status === "pending" && product.aiVerdict && (
              <Badge variant={aiVerdictBadgeVariant(product.aiVerdict)}>
                {AI_VERDICT_LABEL[product.aiVerdict]}
              </Badge>
            )}
            {product.openReportCount > 0 && (
              <Badge variant="warning">
                <Flag className="mr-1 h-3 w-3" aria-hidden />
                通報 {product.openReportCount}
              </Badge>
            )}
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
          {product.reviewNote && product.status !== "pending" && (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              前回の却下理由: {product.reviewNote}
            </p>
          )}
          {product.status === "pending" &&
            product.aiReason &&
            (product.aiVerdict === "flag" || product.aiVerdict === "block") && (
              <p className="mt-1 text-xs text-muted-foreground">
                AI: {product.aiReason}
              </p>
            )}
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
            onApprove={approve}
            onReject={() => setRejecting((v) => !v)}
            rejecting={rejecting}
          />
        </div>
      </div>

      {rejecting && product.status === "pending" && (
        <div className="flex flex-col gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
          <label className="text-xs font-medium text-foreground" htmlFor={`reason-${product.id}`}>
            却下の理由(作者に表示されます)
          </label>
          <textarea
            id={`reason-${product.id}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="例: ストアの趣旨(TRPG 素材)に合わない内容が含まれています。"
            className="w-full resize-y rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={pending || reason.trim().length === 0}
              onClick={reject}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              却下する
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => {
                setRejecting(false);
                setReason("");
              }}
            >
              やめる
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

function Actions({
  status,
  pending,
  onChange,
  onApprove,
  onReject,
  rejecting,
}: {
  status: ProductStatus;
  pending: boolean;
  onChange: (s: ProductStatus) => void;
  onApprove: () => void;
  onReject: () => void;
  rejecting: boolean;
}) {
  // 審査待ち: 承認(公開) / 却下(理由付きで下書きに戻す)。
  if (status === "pending") {
    return (
      <>
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={pending || rejecting}
          onClick={onApprove}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          承認して公開
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={onReject}
        >
          <X className="h-4 w-4" />
          却下
        </Button>
      </>
    );
  }

  // 公開中 / 下書き: 停止のみ(従来仕様)。
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

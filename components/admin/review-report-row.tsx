"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, Check, X, Trash2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  resolveReviewReportAction,
  deleteReviewFromReportAction,
} from "@/app/(app)/admin/reports/actions";
import {
  REPORT_CATEGORY_LABEL,
  REPORT_STATUS_LABEL,
  type ReportStatus,
} from "@/lib/validators/report";
import type { AdminReviewReportRow } from "@/lib/queries/admin";

interface ReviewReportRowProps {
  report: AdminReviewReportRow;
}

const STATUS_VARIANT: Record<ReportStatus, "warning" | "muted" | "default"> = {
  open: "warning",
  reviewed: "muted",
  dismissed: "default",
};

export function AdminReviewReportRowCard({ report }: ReviewReportRowProps) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function resolve(next: ReportStatus) {
    setError(null);
    startTransition(async () => {
      const result = await resolveReviewReportAction(report.id, next);
      if (!result.ok) setError(result.message);
    });
  }

  function remove() {
    if (
      !window.confirm(
        "このレビューを削除します。取り消せません。よろしいですか?",
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const result = await deleteReviewFromReportAction(report.reviewId);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={STATUS_VARIANT[report.status]}>
              {REPORT_STATUS_LABEL[report.status]}
            </Badge>
            <Badge variant="muted">
              {REPORT_CATEGORY_LABEL[report.category]}
            </Badge>
            {report.reviewStars !== null && (
              <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {report.reviewStars}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-medium">
            <Link
              href={`/store/${report.productId}`}
              className="hover:underline"
              aria-label={`「${report.productTitle}」の詳細を確認`}
            >
              {report.productTitle}
            </Link>
          </p>

          {/* 通報されたレビュー本文 */}
          <blockquote className="mt-1 rounded-md border-l-2 border-border bg-muted/40 px-2.5 py-1.5 text-sm text-foreground/80">
            <p className="whitespace-pre-wrap break-words">
              {report.reviewComment || "(本文なし)"}
            </p>
          </blockquote>

          <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-foreground/90">
            <span className="text-xs text-muted-foreground">通報理由: </span>
            {report.reason}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            通報者: {report.reporterLabel} · {formatDate(report.createdAt)}
          </p>
          {error && (
            <p role="alert" className="mt-1 text-xs text-destructive">
              {error}
            </p>
          )}
        </div>

        {report.status === "open" && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={pending}
              onClick={remove}
              title="このレビューを削除します(関連する通報もまとめて消えます)"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              レビュー削除
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => resolve("reviewed")}
            >
              <Check className="h-4 w-4" />
              対応済み
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => resolve("dismissed")}
            >
              <X className="h-4 w-4" />
              却下
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

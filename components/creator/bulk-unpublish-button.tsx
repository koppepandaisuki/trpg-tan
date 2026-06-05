"use client";

import { useState } from "react";
import { Loader2, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { unpublishAllMyProductsAction } from "@/app/(app)/creator/products/actions";

/**
 * 「公開中の作品をすべて非公開(下書きに戻す)」一括ボタン(RRRRR)。
 *
 * 活動休止 / 引退したい creator が、全作品を 1 操作でストアから引っ込める
 * ための手段。RLS の都合で creator は suspended にできないので、draft 化で
 * 実質的な非公開を行う。
 *
 * 二段階確認(confirm())で誤操作を防止。成功後は revalidatePath により
 * 一覧が再描画される(router.refresh は不要)。
 */
interface BulkUnpublishButtonProps {
  publishedCount: number;
}

export function BulkUnpublishButton({
  publishedCount,
}: BulkUnpublishButtonProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    if (
      !window.confirm(
        `公開中の ${publishedCount} 件の作品をすべて下書き(非公開)に戻します。\nストアから見えなくなりますが、作品データは残ります。よろしいですか?`,
      )
    ) {
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await unpublishAllMyProductsAction();
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onClick}
        disabled={submitting}
        className="border-amber-300 text-amber-800 hover:bg-amber-50 hover:text-amber-900"
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <EyeOff className="h-4 w-4" />
        )}
        すべて非公開にする
      </Button>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatPrice } from "@/lib/format/price";
import {
  shortStripeId,
  stripeSessionDashboardUrl,
} from "@/lib/format/stripe";
import type { AdminOrderRow as AdminOrderRowData } from "@/lib/queries/admin";
import { cn } from "@/lib/utils";

interface OrderRowProps {
  order: AdminOrderRowData;
}

export function OrderRow({ order }: OrderRowProps) {
  const dashboardUrl = stripeSessionDashboardUrl(order.stripeSessionId);

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 shadow-sm sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={order.status} />
          <span className="text-xs text-muted-foreground">
            {formatDateTime(order.paidAt ?? order.createdAt)}
          </span>
        </div>
        <p className="mt-1 truncate text-sm font-medium">{order.productTitle}</p>
        <p className="text-xs text-muted-foreground">
          購入者: {order.buyerLabel} · {formatPrice(order.amountJpy)}{" "}
          ({order.currency.toUpperCase()})
        </p>
        <p className="text-xs text-muted-foreground">
          session:{" "}
          <code className="rounded bg-muted px-1 py-0.5">
            {shortStripeId(order.stripeSessionId)}
          </code>
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {dashboardUrl && (
          <a
            href={dashboardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            aria-label="Stripe Dashboard でこの取引を開く(別タブ)"
          >
            <ExternalLink className="h-4 w-4" />
            Stripe で開く
          </a>
        )}
      </div>
    </li>
  );
}

function StatusBadge({ status }: { status: "paid" | "refunded" | "pending" }) {
  switch (status) {
    case "paid":
      return <Badge variant="category">paid</Badge>;
    case "refunded":
      return <Badge variant="default">refunded</Badge>;
    case "pending":
    default:
      return <Badge variant="muted">pending</Badge>;
  }
}

function formatDateTime(iso: string): string {
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

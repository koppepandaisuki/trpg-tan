import Link from "next/link";
import type { Route } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description?: string;
  resetHref?: Route;
  resetLabel?: string;
}

export function EmptyState({
  title,
  description,
  resetHref,
  resetLabel,
}: EmptyStateProps) {
  return (
    <Card className="shadow-sm">
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm font-medium">{title}</p>
        {description && (
          <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
        )}
        {resetHref && resetLabel && (
          <Link
            href={resetHref}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-2")}
          >
            {resetLabel}
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

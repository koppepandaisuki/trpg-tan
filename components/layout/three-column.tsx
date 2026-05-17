import * as React from "react";
import { cn } from "@/lib/utils";

interface ThreeColumnProps {
  left?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  leftWidth?: string;
  rightWidth?: string;
  className?: string;
}

/**
 * Reusable 3-column layout: left sidebar / main / right sidebar.
 * 右カラムは省略可能(`right` を渡さない場合)。
 * 各カラム幅は Tailwind の固定幅クラスを渡す前提。
 */
export function ThreeColumn({
  left,
  right,
  children,
  leftWidth = "w-60",
  rightWidth = "w-80",
  className,
}: ThreeColumnProps) {
  return (
    <div className={cn("mx-auto flex w-full max-w-screen-2xl gap-6 px-4 py-6 sm:px-6", className)}>
      {left && (
        <aside className={cn("hidden shrink-0 lg:block", leftWidth)}>
          <div className="sticky top-20">{left}</div>
        </aside>
      )}
      <main className="min-w-0 flex-1">{children}</main>
      {right && (
        <aside className={cn("hidden shrink-0 xl:block", rightWidth)}>
          <div className="sticky top-20">{right}</div>
        </aside>
      )}
    </div>
  );
}

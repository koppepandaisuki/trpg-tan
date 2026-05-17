import * as React from "react";
import { cn } from "@/lib/utils";

interface SidebarLayoutProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  sidebarWidth?: "default" | "wide";
  className?: string;
}

export function SidebarLayout({
  sidebar,
  children,
  sidebarWidth = "default",
  className,
}: SidebarLayoutProps) {
  return (
    <div className={cn("mx-auto flex w-full max-w-screen-2xl gap-6 px-4 py-6 sm:px-6", className)}>
      <aside
        className={cn(
          "hidden shrink-0 lg:block",
          sidebarWidth === "default" ? "w-60" : "w-72",
        )}
      >
        <div className="sticky top-20">{sidebar}</div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}

import * as React from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "default" | "wide";
}

export function PageContainer({ className, size = "default", ...props }: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 sm:px-6",
        size === "default" ? "max-w-screen-xl" : "max-w-screen-2xl",
        className,
      )}
      {...props}
    />
  );
}

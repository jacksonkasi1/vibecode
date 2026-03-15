// ** import types
import type { ReactNode } from "react";

// ** import utils
import { cn } from "@/lib/utils";

export function VibeMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex h-5 w-5 items-center justify-center text-[15px] leading-none",
        className,
      )}
    >
      ✌️
    </span>
  );
}

export function Panel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-card", className)}>
      {children}
    </div>
  );
}

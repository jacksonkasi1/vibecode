// ** import types
import type { ReactNode } from "react";

// ** import utils
import { cn } from "@/lib/utils";

export function VibeMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("h-5 w-5 text-amber-500", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M12 2.75L13.74 8.26H19.25L14.8 11.7L16.54 17.25L12 13.84L7.46 17.25L9.2 11.7L4.75 8.26H10.26L12 2.75Z"
        fill="currentColor"
      />
    </svg>
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

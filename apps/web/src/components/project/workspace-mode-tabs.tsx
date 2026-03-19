// ** import types
import type { WorkspaceMode } from "./workspace-types";

// ** import utils
import { cn } from "@/lib/utils";
import { WORKSPACE_MODE_OPTIONS } from "./workspace-types";

export function WorkspaceModeTabs({
  value,
  onChange,
}: {
  value: WorkspaceMode;
  onChange: (value: WorkspaceMode) => void;
}) {
  return (
    <div className="flex items-center rounded-lg border border-border/40 bg-muted/20 p-[3px]">
      {WORKSPACE_MODE_OPTIONS.filter(
        (option) => option.value !== "details",
      ).map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-md border px-3 py-1 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            value === option.value
              ? "border-border/50 bg-background text-foreground shadow-sm"
              : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

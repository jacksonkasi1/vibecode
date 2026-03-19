// ** import types
import type { WorkspaceSource } from "./workspace-types";

// ** import core packages
import { Check, ChevronDown, GitBranch } from "lucide-react";

// ** import components
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ** import utils
import {
  WORKSPACE_SOURCE_DESCRIPTIONS,
  WORKSPACE_SOURCE_LABELS,
} from "./workspace-types";

export function WorkspaceSourceSelector({
  value,
  options,
  onChange,
}: {
  value: WorkspaceSource;
  options: WorkspaceSource[];
  onChange: (value: WorkspaceSource) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 border border-transparent px-2.5 text-xs font-medium text-muted-foreground hover:border-border/50 hover:bg-secondary/40 hover:text-foreground"
        >
          <GitBranch className="size-3.5" />
          <span>{WORKSPACE_SOURCE_LABELS[value]}</span>
          <ChevronDown className="size-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {options.map((option) => (
          <DropdownMenuItem
            key={option}
            onClick={() => onChange(option)}
            className="flex items-start gap-3 py-2"
          >
            <div className="flex size-4 items-center justify-center">
              {option === value ? <Check className="size-3.5" /> : null}
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="text-xs font-medium text-foreground">
                {WORKSPACE_SOURCE_LABELS[option]}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {WORKSPACE_SOURCE_DESCRIPTIONS[option]}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ** import core packages
import type { RefObject } from "react";
import { Loader2, Pencil, Square, Trash2 } from "lucide-react";

type ProjectActionsMenuProps = {
  isOpen: boolean;
  x: number;
  y: number;
  menuRef: RefObject<HTMLDivElement | null>;
  canStopWorkspace: boolean;
  isRenamePending: boolean;
  isStopPending: boolean;
  isDeletePending: boolean;
  onRename: () => void;
  onStop: () => void;
  onDelete: () => void;
};

export function ProjectActionsMenu({
  isOpen,
  x,
  y,
  menuRef,
  canStopWorkspace,
  isRenamePending,
  isStopPending,
  isDeletePending,
  onRename,
  onStop,
  onDelete,
}: ProjectActionsMenuProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50"
      onContextMenu={(event) => event.preventDefault()}
    >
      <div
        ref={menuRef}
        className="absolute min-w-40 rounded-md border border-border bg-popover p-1 shadow-md"
        style={{ left: x, top: y }}
      >
        <button
          type="button"
          onClick={onRename}
          disabled={isRenamePending || isDeletePending || isStopPending}
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs text-popover-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Pencil className="h-3 w-3" />
          Rename
        </button>
        <button
          type="button"
          onClick={onStop}
          disabled={!canStopWorkspace || isStopPending}
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs text-popover-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isStopPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Square className="h-3 w-3" />
          )}
          Stop
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={isDeletePending || isStopPending}
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isDeletePending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Trash2 className="h-3 w-3" />
          )}
          Delete
        </button>
      </div>
    </div>
  );
}

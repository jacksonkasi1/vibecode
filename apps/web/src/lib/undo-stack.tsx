// ** import core packages
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

// ** import utils
import { toast } from "sonner";

export interface UndoItem {
  id: string;
  label: string;
  /** Called when the 10-second window expires without an undo — commits the delete to the server */
  onCommit: () => Promise<void>;
  /** Called when the user triggers Cmd+Z — restores the deleted item */
  onRestore: () => Promise<void>;
}

interface UndoStackContextValue {
  /** Push a new deletable item onto the stack. Returns a cancel function that removes it early. */
  push: (item: UndoItem) => () => void;
}

const UndoStackContext = createContext<UndoStackContextValue | null>(null);

const UNDO_TIMEOUT_MS = 10_000;

interface PendingItem {
  item: UndoItem;
  timeoutId: ReturnType<typeof setTimeout>;
}

export function UndoStackProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<PendingItem[]>([]);
  // Keep a stable ref so the keydown handler never captures a stale closure
  const stackRef = useRef<PendingItem[]>([]);
  stackRef.current = stack;

  const removeById = useCallback((id: string) => {
    setStack((prev) => prev.filter((p) => p.item.id !== id));
  }, []);

  const push = useCallback(
    (item: UndoItem): (() => void) => {
      const timeoutId = setTimeout(async () => {
        removeById(item.id);
        try {
          await item.onCommit();
        } catch {
          // commit errors are silent — the item is already gone from the UI
        }
      }, UNDO_TIMEOUT_MS);

      const pending: PendingItem = { item, timeoutId };

      setStack((prev) => [...prev, pending]);

      toast(`${item.label}`, {
        description: "Press ⌘Z to undo",
        duration: UNDO_TIMEOUT_MS,
        id: `undo-${item.id}`,
        action: {
          label: "Undo",
          onClick: async () => {
            clearTimeout(timeoutId);
            removeById(item.id);
            try {
              await item.onRestore();
              toast.success(`${item.label} restored`);
            } catch {
              toast.error(`Failed to restore ${item.label.toLowerCase()}`);
            }
          },
        },
      });

      // Return a cancel function (for programmatic removal without commit/restore)
      return () => {
        clearTimeout(timeoutId);
        removeById(item.id);
      };
    },
    [removeById],
  );

  // Global Cmd+Z / Ctrl+Z listener
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== "z") return;
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if ((e.target as HTMLElement)?.tagName === "TEXTAREA") return;

      const current = stackRef.current;
      if (current.length === 0) return;

      e.preventDefault();

      // Pop the most recently pushed item
      const last = current[current.length - 1];
      clearTimeout(last.timeoutId);
      removeById(last.item.id);
      toast.dismiss(`undo-${last.item.id}`);

      try {
        await last.item.onRestore();
        toast.success(`${last.item.label} restored`);
      } catch {
        toast.error(`Failed to restore ${last.item.label.toLowerCase()}`);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [removeById]);

  return (
    <UndoStackContext.Provider value={{ push }}>
      {children}
    </UndoStackContext.Provider>
  );
}

export function useUndoStack(): UndoStackContextValue {
  const ctx = useContext(UndoStackContext);
  if (!ctx) {
    throw new Error("useUndoStack must be used within <UndoStackProvider>");
  }
  return ctx;
}

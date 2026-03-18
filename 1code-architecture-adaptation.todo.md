# 1code Architecture Adaptation Plan

This document outlines the advanced architectural improvements we can adapt from `1code`'s implementation to make our own workspace, history, and worktree synchronization more robust, performant, and leak-proof.

## Phase 1: Global Undo Stack (The 10-Second Rule)

- [x] **State Management:** Implement a global `undoStack` (using Jotai, Zustand, or React Context) that tracks recently deleted/archived entities (threads, workspaces).
- [x] **Timeouts:** When a user deletes a thread, push its ID to the `undoStack` with a 10-second `setTimeout`. Remove it from the stack when the timer expires.
- [x] **Keyboard Shortcuts:** Add a global `keydown` listener for `Cmd+Z` / `Ctrl+Z`. If the `undoStack` has items, pop the latest item, clear its timeout, and trigger the restore mutation (setting `deletedAt = null` in the DB).
- [x] **UI Feedback:** Show a toast notification when an item is deleted: "Thread deleted. Press Cmd+Z to undo."

## Phase 2: Granular Git Checkpointing

- [x] **Custom Refs:** Instead of just relying on branch merge commits, create an orphaned Git commit for every single AI message/execution. Store it under `refs/checkpoints/<execution_id>`.
- [x] **Tree Storage:** Use `git write-tree` to capture the exact state of the index and the worktree. Store these SHAs in the custom ref's commit message payload as JSON.
- [x] **Why?** This decouples our "undo" capability from the user's actual Git branch history. It prevents cluttering the git log with rollback/revert commits and ensures we always have a perfect snapshot of what the AI saw.

## Phase 3: Low-Level Git Restoration (Two-Phase Rollback)

- [x] **Transition to Plumbing Commands:** Replace `git reset --hard` with faster, more precise Git plumbing commands for restoring state during an undo:
  - `git read-tree <worktreeTree>`
  - `git checkout-index -a -f`
  - `git clean -fd`
  - `git read-tree <indexTree>`
- [x] **Strict Two-Phase Commit:** When rolling back:
  1. Attempt the Git state restoration first.
  2. _Only_ if Git restoration succeeds, update the database (marking executions as `isReverted = true`).
  3. If Git fails, abort the DB transaction and throw an error to prevent UI desync.

## Phase 4: Aggressive Physical Cleanup

- [x] **Worktree Teardown:** When a workspace is permanently deleted (or garbage collected), ensure we run `git worktree remove <path> --force` via a background worker to reclaim disk space instantly.
- [x] **Process Murder:** Ensure any running terminal processes, bash scripts, or active agent workers attached to that `workspaceId` are forcefully killed (`SIGKILL`).
- [x] **Cache Purging:** Wipe out any leftover artifacts, `.log` files, or session JSON caches from the disk specifically tied to the deleted entity to prevent silent storage leaks over time.

## Phase 5: Cascade DB Optimizations

- [x] **Foreign Key Cascades:** Ensure Drizzle schema uses `.references(() => parent.id, { onDelete: "cascade" })` strictly for physical deletions (if we move away from soft deletes for certain entities) so the database handles cleanup natively without complex application logic.

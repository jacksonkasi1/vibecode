# Worktree History, Reset, Rename & Artifacts Implementation

## Phase 1: DB Schema & Migrations

- [x] Create `workspace_revision` table (commit hash, parent hash, execution id, workspace id, created by, created at).
- [x] Create `workspace_operation` table (audit log for rename/reset/revert/merge/conflict).
- [x] Update `execution` table: add `merged_commit_hash`, `worktree_branch`, `is_reverted`, `reverted_by_execution_id`, `reverted_at`.
- [x] Update `chat_thread` table: add `deleted_at`, `archived_at` (soft-delete support).
- [x] Update `artifact` table: add `is_active`, `superseded_by_revision_id`.
- [x] Generate Drizzle migrations.

## Phase 2: Backend API & Worker Consistency

- [x] Threads: Implement `PATCH /api/threads/:id` (rename).
- [x] Threads: Implement `DELETE /api/threads/:id` (soft delete).
- [x] Threads: Implement `GET /api/threads/:id/messages` (paginated message history).
- [x] Workspaces: Implement `GET /api/workspaces/:id/history` (unified timeline).
- [x] Workspaces: Implement `GET /api/workspaces/:id/revisions` (commit-based history).
- [x] Reset/Revert: Implement `POST /api/workspaces/:id/reset` (to specific revision/execution).
- [x] Reset/Revert: Implement `POST /api/executions/:id/revert` with strict validation.
- [x] Worker: Persist merge commit hash & branch per successful execution.
- [x] Worker: Fix cancellation bug (prevent writing `completed` if cancelled).
- [x] Worker: Keep conflict branches visible in history with clear status.

## Phase 3: Frontend Data Integration & UX

- [x] API Clients: Add REST clients for new thread/history/reset endpoints.
- [x] Threads: Wire `onRenameThread` and `onDeleteThread` in `Project.tsx`.
- [x] UI: Expand history panel into a grouped timeline.
- [x] UI: Add reset action UI with explicit confirmation.
- [x] UI: Add multi-select mode for history items.

## Phase 4: Reconciliation (Artifacts/Revisions)

- [x] Artifacts: Update logic to mark superseded artifacts inactive on reset.
- [x] Artifacts: Update API `GET /api/workspaces/:id/artifacts` to filter by active revision.
- [x] Frontend: Update Project page to read artifacts for the selected revision.

## Phase 5: Testing & Rollout

- [x] Add unit tests for API validations.
- [x] Add integration tests for create → merge → reset → history consistency.

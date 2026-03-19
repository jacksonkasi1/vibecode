# LangChain Deep Agents Migration Todo

## Branch

- Working branch: `feat/langchain-deepagents-migration-plan`

## Goal

Replace VIBECode's custom agent runtime with LangChain Deep Agents for the execution engine while keeping VIBECode's product shell intact.

This migration must cover:

- agent execution loop
- subagent delegation
- task/todo workflow
- context compaction/offloading
- skills loading/runtime
- memory/subagent definitions
- tool-calling orchestration

This migration happens before the full capabilities rollout in `skills-capabilities-task-list.md`.
The capabilities work should build on top of the new Deep Agents-based runtime, not the old custom orchestrator.

## Keep vs Replace

### Keep in VIBECode

- project, workspace, auth, and billing flows
- DB ownership of executions, threads, artifacts, and capability metadata
- Hono API surface and SSE delivery
- UI shell, assistant views, artifact views, and project management UX
- workspace/worktree lifecycle where it is VIBE-specific
- global vs project capability model from `skills-capabilities-task-list.md`

### Replace with Deep Agents

- custom agent loop in the worker
- custom multi-agent orchestration semantics
- custom planner/orchestrator stop logic
- custom tool-call continuation semantics
- custom task/todo orchestration model
- custom memory/offload strategy
- custom subagent runtime contract

## Success Criteria

- A complex prompt can spawn subagents, continue across multiple steps, and only stop when the task is complete or blocked.
- A failed subtask triggers re-planning or explicit failure handling instead of a one-shot summary.
- SSE and UI show real execution progress: active subagents, tool activity, verification, retries, and completion.
- Skills still work after migration.
- Deep Agents-backed runs persist enough metadata in VIBECode DB for history, timeline, replay, and artifact inspection.
- `skills-capabilities-task-list.md` can be implemented on top of the new runtime without redoing runtime integration work.

## Target Architecture

### Reference implementation to mirror

- Local reference repo: `explore/deepagents`
- The Python implementation confirms the architecture we should mirror in TypeScript:
  - base prompt + middleware stack, not a hand-written while loop
  - `TodoListMiddleware` for task tracking
  - `MemoryMiddleware` for always-on `AGENTS.md` loading
  - `SkillsMiddleware` for progressive skill discovery and injection
  - `FilesystemMiddleware` for file tools
  - `SubAgentMiddleware` for delegation via `task`
  - summarization/offload middleware for context compaction
  - patching middleware for tool-call normalization

### Key lessons from the Python Deep Agents repo

- The main runtime is assembled in `explore/deepagents/libs/deepagents/deepagents/graph.py`, where the agent is created from a middleware stack instead of custom loop control.
- The base prompt explicitly says: keep working until complete or genuinely blocked. We should preserve that product rule in the TS migration.
- Skills are layered by source precedence in `explore/deepagents/libs/cli/deepagents_cli/skills/load.py`: built-in < user < alias-user < project < alias-project. This matches the direction of our capabilities plan.
- Subagents are file-backed definitions with frontmatter + body in `explore/deepagents/libs/cli/deepagents_cli/subagents.py`. This is a strong model for our custom agent loader migration.
- Memory is always-on context from `AGENTS.md`, while skills are on-demand task-specific capabilities. We should preserve this distinction.
- Offload is treated as a first-class workflow with persisted history in `explore/deepagents/libs/cli/deepagents_cli/offload.py`, not a hidden implementation detail.
- The integration tests in `explore/deepagents/libs/deepagents/tests/integration_tests/test_deepagents.py` validate delegation behavior directly. We should build similar parity tests in VIBECode.

### Context7-backed TypeScript implementation notes

- Context7 confirms the JS/TS package exposes `createDeepAgent(...)` as the main entry point, with built-in todos, filesystem tools, task delegation, and summarization.
- Context7 confirms the JS/TS package exposes dedicated middleware constructors we should use directly where needed:
  - `createFilesystemMiddleware(...)`
  - `createSubAgentMiddleware(...)`
  - `createSkillsMiddleware(...)`
  - `createMemoryMiddleware(...)`
- Context7 confirms Deep Agents JS supports backend composition patterns we can map onto VIBECode workspace needs:
  - `StateBackend` for ephemeral state
  - `FilesystemBackend` for workspace files
  - `LocalShellBackend` for shell execution
  - `CompositeBackend` for combining persistence modes
- Context7 confirms `interruptOn` + `checkpointer` is the supported path for human approval / resumable execution, which matters for future approval workflows.
- Context7 confirms the returned run result can expose `messages`, `todos`, and `files`, which we should normalize into VIBECode execution records and UI timeline state.

### Runtime shape

- `apps/worker` becomes a Deep Agents execution host.
- Deep Agents owns the inner agent loop.
- VIBECode owns the outer execution lifecycle: queue claim, workspace checkout, auth context, persistence, SSE, artifacts, and cleanup.

### Agent model

- Main execution agent is a Deep Agent.
- VIBECode built-in specialists become Deep Agents subagents.
- User-defined custom agents are mapped to Deep Agents subagent definitions.
- Skills are loaded into Deep Agents skill directories / runtime input adapters.

### State model

- `execution` remains the root product record.
- Event streaming remains DB-backed for the web app.
- Deep Agents events are normalized into VIBECode execution events.
- Task and subagent progress are persisted in VIBECode tables instead of living only inside the LangChain runtime.

## Dependency Changes

## Phase 0: Package and dependency preparation

- [ ] Add LangChain / Deep Agents JS dependencies to the workspace packages that will host runtime execution.
- [ ] Decide whether Deep Agents runtime lives directly in `apps/worker` or behind a new package such as `packages/agent-runtime`.
- [ ] Keep `@repo/ai` only if it still adds value for shared VIBECode abstractions; otherwise reduce it to compatibility helpers or retire it.
- [ ] Define provider configuration strategy for Gemini and future providers through LangChain-compatible model setup.
- [ ] Define tracing strategy for local development and production.
- [ ] Align package choices with real JS APIs from Context7 instead of porting Python internals one-for-one.

### Expected package changes

- [ ] Update `apps/worker/package.json`
- [ ] Update `packages/ai/package.json` or replace its role
- [ ] Potentially add `packages/agent-runtime/package.json`
- [ ] Update root lockfile after dependency changes
- [ ] Add Deep Agents JS runtime dependencies and required LangChain packages.
- [ ] Add LangGraph checkpoint/store packages if we adopt interrupts, resume, or persistent thread state.

## Phase 1: ADR and migration contract

- [ ] Write an ADR explaining why the custom orchestrator is being replaced.
- [ ] Document the product boundary: Deep Agents as runtime engine, VIBECode as application shell.
- [ ] Define parity requirements before deleting old runtime code.
- [ ] Define rollout mode: dark launch, opt-in flag, or direct cutover.
- [ ] Define fallback behavior if Deep Agents runtime fails mid-execution.

## Phase 2: Database schema plan

Deep Agents can run internally without our schema, but VIBECode still needs durable product records.

### Keep and evolve

- [ ] Keep `execution` as the top-level record in `packages/db/src/schema/executions.ts`.
- [ ] Keep `chat_thread` and `chat_message` linkage for user-visible history.
- [ ] Keep `artifact` linkage unchanged unless runtime-generated artifacts require more metadata.

### Schema additions / changes

- [ ] Add `runtime` or `engine` field to `execution` to distinguish `custom` vs `deepagents` runs.
- [ ] Add `runId` / `runtimeExecutionId` field to map a VIBECode execution to a Deep Agents run/thread identifier.
- [ ] Add `executionMode` or `orchestrationMode` if needed for single-agent vs delegated execution.
- [ ] Add optional `skillSelectionJson` or equivalent metadata to persist selected skills for a run.
- [ ] Add optional `memorySnapshotRef` / `offloadRef` metadata if offloaded context must be inspectable.

### Task/subagent persistence

- [ ] Review whether `agent_task` in `packages/db/src/schema/executions.ts` can remain as the UI-facing task table.
- [ ] If `agent_task` remains, adapt it to store Deep Agents subagent runs, parent-child relationships, status, and summary.
- [ ] If `agent_task` is too custom, replace it with a more generic `execution_task` / `execution_run_node` table.

### Event persistence

- [ ] Keep `execution_event` in `packages/db/src/schema/execution-events.ts` as the normalized streaming source.
- [ ] Define normalized event types for:
  - `run:start`
  - `run:update`
  - `assistant:delta`
  - `tool:call`
  - `tool:result`
  - `task:start`
  - `task:update`
  - `task:complete`
  - `memory:offload`
  - `skill:selected`
  - `verification:start`
  - `verification:complete`
  - `execution:block`
- [ ] Add indexes if event volume will materially increase.

### Migration tasks

- [ ] Create Drizzle migration for new execution fields.
- [ ] Create Drizzle migration for any new task/run tables if needed.
- [ ] Update exported schema/types in `packages/db/src/schema/index.ts` and `packages/db/src/index.ts`.

## Phase 3: Runtime package design

- [ ] Create a dedicated Deep Agents adapter layer instead of scattering LangChain calls across `apps/worker`.
- [ ] Define `startExecution`, `resumeExecution`, `cancelExecution`, and `streamExecutionEvents` interfaces.
- [ ] Define an adapter that converts VIBECode workspace/tool context into Deep Agents runtime context.
- [ ] Define an adapter that converts Deep Agents callbacks/events into DB writes and SSE-compatible events.
- [ ] Define a stable result envelope returned back to `apps/worker` once a run ends.
- [ ] Mirror the Python `create_deep_agent(...)` assembly pattern from `explore/deepagents/libs/deepagents/deepagents/graph.py` instead of rebuilding control flow manually.
- [ ] Base the TS assembly on the real `createDeepAgent(...)` API from Context7 instead of inventing a custom wrapper shape first.

### Preferred Deep Agents JS construction shape

- [ ] Create a main runtime factory around `createDeepAgent({ model, tools, systemPrompt, subagents, skills, memory, backend, checkpointer, interruptOn, middleware })`.
- [ ] Prefer backend injection over direct filesystem access from the orchestration layer.
- [ ] Use middleware composition instead of special-case branching in the worker.
- [ ] Normalize Deep Agents result fields (`messages`, `todos`, `files`) into a VIBECode execution result object.

### Likely new files

- [ ] `packages/agent-runtime/src/index.ts` or equivalent
- [ ] `packages/agent-runtime/src/deepagents/runtime.ts`
- [ ] `packages/agent-runtime/src/deepagents/tools.ts`
- [ ] `packages/agent-runtime/src/deepagents/subagents.ts`
- [ ] `packages/agent-runtime/src/deepagents/skills.ts`
- [ ] `packages/agent-runtime/src/deepagents/events.ts`
- [ ] `packages/agent-runtime/src/deepagents/memory.ts`
- [ ] `packages/agent-runtime/src/deepagents/offload.ts`
- [ ] `packages/agent-runtime/src/types.ts`

## Phase 4: Tool migration

Port the current worker tools into Deep Agents-compatible tools.

- [ ] Wrap file tools from `apps/worker/src/tools/read-file.ts`, `apps/worker/src/tools/write-file.ts`, `apps/worker/src/tools/list-files.ts`, and `apps/worker/src/tools/search-code.ts`.
- [ ] Wrap shell execution from `apps/worker/src/tools/execute-command.ts`.
- [ ] Wrap git/worktree actions from `apps/worker/src/tools/git-actions.ts`.
- [ ] Preserve workspace path safety and file ownership constraints.
- [ ] Re-implement approval / safety policy in the new tool adapter layer.
- [ ] Ensure tool results are structured enough for event rendering and retry logic.
- [ ] Decide whether VIBECode should use `LocalShellBackend` directly or wrap it to preserve workspace/worktree isolation and existing safety checks.
- [ ] Decide whether workspace files should be surfaced through `FilesystemBackend`, `CompositeBackend`, or a custom backend adapter.

### Files likely updated

- [ ] `apps/worker/src/tools/*.ts` as reusable low-level primitives, or move logic into a new runtime package
- [ ] `apps/worker/src/tools/index.ts`
- [ ] `apps/worker/src/tools.ts`

### Files likely removed after parity

- [ ] `apps/worker/src/tools/task-tool.ts` (Deep Agents should own delegation)

## Phase 5: Subagent migration

- [ ] Convert built-in agent definitions in `packages/ai/src/agents/registry.ts` into Deep Agents subagent definitions.
- [ ] Preserve current specialist roles: `frontend`, `backend`, `coder`, `tester`, `researcher`, `debugger`.
- [ ] Map custom user-defined agents from `packages/ai/src/agents/loader.ts` into Deep Agents-compatible subagent config.
- [ ] Define which tools each subagent gets.
- [ ] Define model overrides per subagent where needed.
- [ ] Preserve file ownership semantics for parallel work.

### Files likely updated

- [ ] `packages/ai/src/agents/registry.ts` or replace with a Deep Agents-oriented subagent registry
- [ ] `packages/ai/src/agents/loader.ts`
- [ ] `packages/ai/src/agents/types.ts`

### Files likely removed after parity

- [ ] Custom orchestrator-specific planning prompt logic embedded in `packages/ai/src/agents/registry.ts`

## Phase 6: Execution loop replacement

- [ ] Replace the custom loop in `apps/worker/src/runner.ts` with a Deep Agents-backed execution flow.
- [ ] Remove the current "no tool call means done" assumption.
- [ ] Support long-running delegated execution until explicit completion or unrecoverable block.
- [ ] Support cancellation at the VIBECode execution level.
- [ ] Support resume/re-entry if Deep Agents and VIBECode execution state need recovery.
- [ ] Preserve workspace bootstrapping, git setup, checkpointing, artifact synthesis, and cleanup.

### Files likely updated heavily

- [ ] `apps/worker/src/runner.ts`
- [ ] `apps/worker/src/index.ts`
- [ ] `apps/worker/src/poller.ts`
- [ ] `apps/worker/src/pubsub.ts`

### Files likely removed after parity

- [ ] `apps/worker/src/lib/task-planner.ts`
- [ ] orchestrator-specific stop/retry logic in `apps/worker/src/lib/retry.ts` if replaced by Deep Agents runtime behavior

## Phase 7: Memory and context offload

- [ ] Adopt Deep Agents memory and conversation offload model instead of the current custom compaction behavior.
- [ ] Decide where the persisted memory files live for workspace-scoped runs.
- [ ] Decide how global memory should relate to user/project capabilities later.
- [ ] Persist enough metadata so the web app can show that context was compacted or offloaded.
- [ ] Ensure workspace cleanup does not accidentally delete user-level memory that must survive.
- [ ] Use `createMemoryMiddleware(...)` for always-on `AGENTS.md` loading rather than mixing memory into skill loading.
- [ ] Decide whether offloaded history lives in VIBECode storage, backend filesystem, or both.

### Files likely updated

- [ ] `apps/worker/src/runner.ts`
- [ ] possibly new memory storage adapter files
- [ ] `packages/db` schema if offload metadata is persisted

## Phase 8: Skills support during migration

This migration must not break skills. It should become the runtime foundation for `skills-capabilities-task-list.md`.

- [ ] Map existing skill discovery in `apps/worker/src/skills/index.ts` into Deep Agents skill loading.
- [ ] Support built-in skills.
- [ ] Support project-local skills.
- [ ] Support hydrated global skills once capability sync exists.
- [ ] Keep progressive skill selection instead of dumping all skills into the prompt.
- [ ] Persist selected-skill metadata into execution records/events for UI and debugging.
- [ ] Make sure the later capability rollout only needs storage/sync/UI work, not another runtime rewrite.
- [ ] Mirror Deep Agents source precedence and alias handling from `explore/deepagents/libs/cli/deepagents_cli/skills/load.py` wherever it does not conflict with VIBECode's `All Projects` vs `This Project` model.
- [ ] Use `createSkillsMiddleware(...)` rather than manual prompt concatenation for skill runtime loading.

### Files likely updated

- [ ] `apps/worker/src/skills/index.ts`
- [ ] runtime package skill adapter files
- [ ] later integration points from `skills-capabilities-task-list.md`

## Phase 9: Server API and streaming changes

- [ ] Keep execution creation in `apps/server/src/routes/executions/create.ts` but add runtime selection metadata if needed.
- [ ] Keep execution SSE in `apps/server/src/routes/executions/stream.ts`, but ensure new event types stream correctly.
- [ ] Keep agent/task APIs in `apps/server/src/routes/executions/agents.ts`, but back them with Deep Agents-driven task records.
- [ ] Add runtime info to list/get execution endpoints if needed.
- [ ] Add diagnostics endpoints only if debugging needs cannot be covered by existing APIs.

### Files likely updated

- [ ] `apps/server/src/routes/executions/create.ts`
- [ ] `apps/server/src/routes/executions/get.ts`
- [ ] `apps/server/src/routes/executions/list.ts`
- [ ] `apps/server/src/routes/executions/stream.ts`
- [ ] `apps/server/src/routes/executions/agents.ts`
- [ ] `apps/server/src/lib/execution-dispatch.ts`

## Phase 10: Frontend changes

The UI must stop pretending execution is only a stream of assistant text.

### Required behavior

- [ ] Show active runtime state, not just final assistant prose.
- [ ] Show subagents as first-class progress items.
- [ ] Show task states: queued, running, completed, failed, retried.
- [ ] Show tool usage with structured grouping.
- [ ] Show verification phases and failures.
- [ ] Show skill selection / capability usage for transparency.
- [ ] Show offload/compaction markers if context is compressed.

### Files likely updated

- [ ] `apps/web/src/pages/project/hooks/use-project-actions.ts`
- [ ] `apps/web/src/components/apps/AgentTimeline.tsx`
- [ ] `apps/web/src/components/apps/AgentProgress.tsx`
- [ ] `apps/web/src/components/assistant/vibe-assistant-thread.tsx`
- [ ] `apps/web/src/components/assistant-ui/tool-group.tsx`
- [ ] `apps/web/src/rest-api/executions/get-agent-tasks.ts`
- [ ] `apps/web/src/rest-api/executions/get-executions.ts`
- [ ] `apps/web/src/rest-api/executions/get-execution.ts`
- [ ] `apps/web/src/pages/Project.tsx`

### Frontend-specific tasks

- [ ] Replace the current "append assistant:delta only" stream reducer with an event-aware reducer.
- [ ] Normalize execution events into a UI timeline model.
- [ ] Render delegated subagents even when the assistant is not emitting prose.
- [ ] Show a richer final result summary assembled from execution records + events.
- [ ] Preserve current assistant message UX for simple single-agent runs.
- [ ] Add empty/error states for missing runtime event data.

## Phase 11: Remove or retire old custom runtime code

Remove only after parity is proven.

### High-confidence removal candidates

- [ ] `apps/worker/src/lib/task-planner.ts`
- [ ] `apps/worker/src/tools/task-tool.ts`

### Likely retirement / heavy reduction candidates

- [ ] `packages/ai/src/providers/gemini.ts`
- [ ] `packages/ai/src/providers/base.ts`
- [ ] `packages/ai/src/providers/index.ts`
- [ ] `packages/ai/src/types.ts`
- [ ] `packages/ai/src/registry.ts`
- [ ] `packages/ai/src/index.ts`

### Keep only if still useful

- [ ] `packages/ai/src/agents/loader.ts` as a parser/compatibility adapter for custom user agent definitions
- [ ] `apps/worker/src/lib/retry.ts` if reused for non-LangChain transient infrastructure retries
- [ ] `apps/worker/src/lib/result-merger.ts` if still needed for artifact synthesis and merge handling

## Phase 12: Testing and rollout

- [ ] Add unit tests for Deep Agents adapter code.
- [ ] Add integration tests for delegated task execution.
- [ ] Add integration tests for execution cancellation.
- [ ] Add integration tests for failed subagent -> retry/replan -> complete flow.
- [ ] Add integration tests for skills being selected and loaded during runs.
- [ ] Add integration tests for SSE event streaming and UI reduction logic.
- [ ] Add migration tests for DB schema changes.
- [ ] Run `bun run check-types`.
- [ ] Run worker, server, and web validation commands.
- [ ] Test at least one complex prompt end-to-end in the browser.
- [ ] Add parity tests around `messages`, `todos`, and `files` mapping from Deep Agents results into VIBECode DB/UI state.

## Ordered Delivery Plan

- [ ] Step 1: add ADR and decide package boundaries
- [ ] Step 2: add dependencies and runtime adapter skeleton
- [ ] Step 3: migrate low-level tools
- [ ] Step 4: migrate subagent definitions
- [ ] Step 5: replace worker execution loop
- [ ] Step 6: normalize Deep Agents events into DB + SSE
- [ ] Step 7: update frontend to render runtime events correctly
- [ ] Step 8: wire skill loading into Deep Agents runtime
- [ ] Step 9: remove old custom orchestration code
- [ ] Step 10: run end-to-end validation and then start `skills-capabilities-task-list.md`

## Explicit file inventory

### Core files to update

- `apps/worker/src/runner.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/poller.ts`
- `apps/worker/src/pubsub.ts`
- `apps/worker/src/tools.ts`
- `apps/worker/src/tools/index.ts`
- `apps/worker/src/skills/index.ts`
- `apps/server/src/lib/execution-dispatch.ts`
- `apps/server/src/routes/executions/create.ts`
- `apps/server/src/routes/executions/get.ts`
- `apps/server/src/routes/executions/list.ts`
- `apps/server/src/routes/executions/stream.ts`
- `apps/server/src/routes/executions/agents.ts`
- `apps/web/src/pages/project/hooks/use-project-actions.ts`
- `apps/web/src/components/apps/AgentTimeline.tsx`
- `apps/web/src/components/apps/AgentProgress.tsx`
- `apps/web/src/components/assistant/vibe-assistant-thread.tsx`
- `apps/web/src/components/assistant-ui/tool-group.tsx`
- `apps/web/src/pages/Project.tsx`
- `packages/db/src/schema/executions.ts`
- `packages/db/src/schema/execution-events.ts`
- `packages/db/src/schema/index.ts`
- `packages/db/src/index.ts`
- `packages/ai/src/agents/registry.ts`
- `packages/ai/src/agents/loader.ts`
- `packages/ai/src/agents/types.ts`
- `apps/worker/package.json`
- `packages/ai/package.json`

### New files likely needed

- `packages/agent-runtime/src/index.ts`
- `packages/agent-runtime/src/types.ts`
- `packages/agent-runtime/src/deepagents/runtime.ts`
- `packages/agent-runtime/src/deepagents/tools.ts`
- `packages/agent-runtime/src/deepagents/subagents.ts`
- `packages/agent-runtime/src/deepagents/skills.ts`
- `packages/agent-runtime/src/deepagents/events.ts`
- `packages/agent-runtime/src/deepagents/memory.ts`
- `packages/agent-runtime/src/deepagents/offload.ts`
- Drizzle migration files for execution/runtime schema changes

### Files to remove after parity

- `apps/worker/src/tools/task-tool.ts`
- `apps/worker/src/lib/task-planner.ts`

### Files to evaluate for removal after parity

- `packages/ai/src/providers/gemini.ts`
- `packages/ai/src/providers/base.ts`
- `packages/ai/src/providers/index.ts`
- `packages/ai/src/types.ts`
- `packages/ai/src/registry.ts`
- `packages/ai/src/index.ts`

## Definition of Done

- [ ] Complex prompts continue through delegation until completion or explicit block.
- [ ] Browser UI shows real multi-agent execution progress.
- [ ] Skills still function in the new runtime.
- [ ] Old custom orchestrator-specific loop is retired.
- [ ] The repository is ready to start the capability implementation in `skills-capabilities-task-list.md` on top of the new runtime.

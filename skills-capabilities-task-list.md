# Skills and Capabilities Detailed Task List

## Goal

Build a shared capabilities system that supports `skills` first, with the same foundation reusable for `agents` and `mcp` later. The system must support both terminal-based installs inside a workspace VM and UI-based installs from anywhere, while making `All Projects` truly user-global through cloud-backed persistence.

## Product rules

- `All Projects` means user-level and cloud-backed.
- `This Project` means workspace-level and local to that project.
- Runtime execution reads from local hydrated files.
- Global capability state must survive new VM and new workspace creation.
- UI is required for visibility and management.
- Terminal install remains supported for developers.
- UI does not edit skill contents; it manages install state only.

## Phase 1: Capability Domain Model

- [ ] Define a generic capability model that can represent `skills` now and `agents` / `mcp` later.
- [ ] Define shared fields such as `id`, `name`, `kind`, `scope`, `source`, `enabled`, `builtIn`, `overrideOf`, `version`, `hash`, `createdAt`, `updatedAt`.
- [ ] Define scope enum and semantics for `project` and `global`.
- [ ] Define precedence rules: `project > global > built-in`.
- [ ] Define validation and error states for malformed bundles.
- [ ] Define how delete behaves for built-in vs imported capabilities.
- [ ] Write ADR documenting why cloud-backed global state is required.

## Phase 2: Storage and Metadata

- [ ] Design metadata schema for user-global capabilities.
- [ ] Add DB records for capability metadata, install source, enabled state, and storage object path.
- [ ] Define GCS object layout for global skill bundles.
- [ ] Define bundle hashing/versioning strategy for cache invalidation.
- [ ] Define audit fields for install, enable, disable, delete, and sync operations.
- [ ] Define soft-delete or hard-delete rules for global capability bundles.

## Phase 3: Bundle Format and Loader

- [ ] Finalize supported skill bundle layout compatible with `skills.sh` style packages.
- [ ] Detect bundles by `SKILL.md` presence.
- [ ] Parse metadata from `SKILL.md` or companion manifest if needed.
- [ ] Add loader for built-in skills.
- [ ] Add loader for global hydrated skills.
- [ ] Add loader for project-local skills.
- [ ] Merge loaders into one registry with precedence handling.
- [ ] Add enable/disable filtering in registry output.
- [ ] Add safe handling for invalid bundles so one bad skill does not break startup.

## Phase 4: Global Import Pipeline

- [ ] Build backend import flow for `All Projects` installs that does not require a workspace VM.
- [ ] Support repo URL as the first install source.
- [ ] Evaluate registry/package identifiers as a second supported source.
- [ ] Fetch remote bundle in backend job.
- [ ] Validate expected files and bundle shape.
- [ ] Extract metadata and normalize capability name.
- [ ] Upload bundle to GCS.
- [ ] Persist metadata record and enabled state.
- [ ] Return normalized install result for UI.
- [ ] Handle reinstall / upgrade / duplicate name collision rules.

## Phase 5: Workspace Hydration and Sync

- [ ] Add workspace startup hydration for enabled global skills.
- [ ] Download missing or outdated global bundles from GCS to local runtime cache.
- [ ] Keep local runtime path stable for the worker loader.
- [ ] Reconcile deleted or disabled global bundles during hydration.
- [ ] Define refresh strategy for already-running workspaces after global changes.
- [ ] Add sync status reporting for UI and debugging.

## Phase 6: Terminal Install Detection

- [ ] Support `skills.sh` installs inside workspace terminal.
- [ ] Detect local terminal-installed skill bundles in workspace paths.
- [ ] Surface detected bundles in backend registry response.
- [ ] Classify detected bundles as `This Project` by default unless explicitly promoted.
- [ ] Define promotion flow from project-local install to `All Projects` if needed later.
- [ ] Ensure UI reflects terminal-installed bundles without manual refresh complexity.

## Phase 7: API Surface

- [ ] Add endpoint to list capabilities with merged and scoped views.
- [ ] Add endpoint to list only skills for current workspace/user.
- [ ] Add endpoint to install global skill from repo URL.
- [ ] Add endpoint to install project skill when workspace is available.
- [ ] Add endpoint to enable capability.
- [ ] Add endpoint to disable capability.
- [ ] Add endpoint to delete capability.
- [ ] Add endpoint to inspect capability metadata and source.
- [ ] Add endpoint to expose sync status and override status.

## Phase 8: UI - Capabilities Panel

- [ ] Add a lightweight `Capabilities` entry point as an icon button, drawer, or side panel.
- [ ] Avoid adding a new heavy top-level tab.
- [ ] Add section navigation for `Skills` first, with future slots for `Agents` and `MCP`.
- [ ] Add scope switcher labeled `This Project` and `All Projects`.
- [ ] Show capability cards or rows with `name`, `description`, `source`, `enabled`, `scope`, and `override` status.
- [ ] Add install action for `All Projects` using repo URL / package source.
- [ ] Add enable/disable action.
- [ ] Add delete action with safe confirmation.
- [ ] Add metadata/details view for transparency.
- [ ] Add empty states and malformed-skill warning states.

## Phase 9: Runtime Injection

- [ ] Add skill catalog availability to the runner/orchestrator.
- [ ] Implement selection of relevant skills per task.
- [ ] Inject only selected skill instructions into the runtime prompt.
- [ ] Add progressive disclosure for resources referenced by selected skills.
- [ ] Keep prompts bounded so all installed skills are not blindly injected.
- [ ] Log which skills were selected for a run.
- [ ] Prepare the same pattern for future `agents` and `mcp` capability orchestration.

## Phase 10: Trust, Debugging, and Observability

- [ ] Show source URL or bundle origin in UI.
- [ ] Show whether a capability is built-in, project, or all-projects.
- [ ] Show when a project skill overrides a global or built-in one.
- [ ] Show sync errors and validation errors clearly.
- [ ] Log import, hydration, enable, disable, and delete events.
- [ ] Add operator-friendly diagnostics for missing bundle files or GCS drift.

## Phase 11: Testing

- [ ] Add loader tests for built-in/global/project precedence.
- [ ] Add tests for invalid or partially missing skill bundles.
- [ ] Add tests for global import pipeline from repo URL.
- [ ] Add tests for hydration into fresh workspace.
- [ ] Add tests for terminal-installed project skills being detected.
- [ ] Add API tests for enable, disable, delete, and list behavior.
- [ ] Add UI tests for scope switching and capability state changes.
- [ ] Add runner tests for selected skill prompt injection.
- [ ] Run `bun run check-types` with zero errors.

## Delivery sequence

- [ ] First: capability model + ADR.
- [ ] Second: global storage + metadata schema.
- [ ] Third: bundle loader + merged registry.
- [ ] Fourth: backend global importer.
- [ ] Fifth: workspace hydration.
- [ ] Sixth: capabilities UI panel.
- [ ] Seventh: runtime skill injection.
- [ ] Eighth: polish, tests, and rollout.

## Non-goals for this phase

- [ ] Do not build a custom VIBECode CLI for skill installation.
- [ ] Do not build in-app editing for `SKILL.md`.
- [ ] Do not make the runner read directly from GCS.
- [ ] Do not add a large top-level navigation tab just for capabilities.

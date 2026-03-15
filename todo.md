Here’s the **clean Notion-style version**.

## To-Do List and Checklist for Phase 1 & Phase 2

### Now

Build the foundation and one reliable coding agent.

#### Product

- [x] Set up monorepo with **Bun + Turborepo + TypeScript**
- [x] Create `apps/web`
- [x] Create `apps/server`
- [x] Create `apps/worker`
- [x] Create `packages/shared`
- [x] Add shared `tsconfig`, linting, formatting, path aliases

#### Web

- [ ] Set up **Vite + React + Tailwind CSS**
- [ ] Add **shadcn/ui** under `apps/web/src/components/ui`
- [ ] Create pages for:
  - [ ] project list
  - [ ] workspace view
  - [ ] model settings
  - [ ] logs/artifacts

- [ ] Build prompt input UI
- [ ] Build live activity/streaming panel

#### Server

- [x] Set up **Hono**
- [x] Add **Zod** validation
- [x] Create routes for:
  - [x] projects
  - [x] workspaces
  - [x] executions/tasks
  - [x] models/providers
  - [x] artifacts

- [x] Add health check route
- [x] Add SSE or WebSocket streaming

#### Worker

- [x] Build execution runtime
- [x] Add one **single coding agent**
- [x] Add tools for:
  - [x] file read/write
  - [x] shell command execution
  - [ ] repo search
  - [ ] git actions
  - [x] artifact saving

- [x] Add structured logs/events
- [x] Add failure/retry handling

#### Workspace runtime

- [ ] Execute tasks safely within local isolated folders

#### Models

- [x] Add **Gemini API** integration first
- [x] Add provider abstraction
- [ ] Add optional **Vertex AI** support later
- [x] Keep model config centralized
- [ ] Add these initial models:
  - [ ] `gemini-3.1-pro-preview`
  - [ ] `gemini-3-flash-preview`
  - [ ] `gemini-3.1-flash-lite-preview`

#### Phase 1 done when

- [ ] A project can be opened
- [ ] A workspace can start
- [ ] The agent can read and edit code
- [ ] The agent can run commands
- [ ] Output streams live to the UI
- [ ] Logs/artifacts are saved
- [ ] Workspace can stop and resume

---

### Phase 1.2: Cloud Infrastructure & Security (GCP)

Move the execution environment from simple local processes to secure, scalable Google Cloud Compute Engine VMs with dual-mode support for local development.

#### Dual-Mode Architecture
- [ ] Keep existing local DB Poller loop (`poller.ts`) for local development
- [ ] Add Google Cloud Pub/Sub listener for production environment
- [ ] Create environment toggle: local DB polling vs production Pub/Sub

#### Cloud VM Orchestration (Server)
- [ ] Integrate `@google-cloud/compute` SDK in `apps/server`
- [ ] Build API to dynamically spawn Compute Engine VMs (scale to zero)
- [ ] Map instance sizing endpoints (Standard `e2-medium`, Pro `e2-standard-4`)
- [ ] Create VM Startup Script (Bash) that:
  - [ ] Pulls the VIBECode Worker repo/image
  - [ ] Injects `EXECUTION_ID` and `DATABASE_URL` 
  - [ ] Auto-shuts down (`sudo poweroff`) when execution completes
- [ ] Build custom VM Machine Image (pre-installed Ubuntu, Node v20, Bun v1.2, Python)

#### Zero-Latency Sandboxing (Worker)
- [ ] Set up strict Linux User Permissions on the Worker VM
  - [ ] `vibecode-admin`: Runs the Node app, owns `.env`, restricted access (`chmod 700`)
  - [ ] `workspace-user`: Unprivileged user for AI code execution
- [ ] Refactor `execute_command` tool to run via `sudo -u workspace-user -- bash -c`
- [ ] Create restricted filesystem jail (`chroot`) mapping to GitHub repo

#### Workspace State Management
- [ ] Auto-pull target user code from GitHub on VM boot
- [ ] Upload final artifacts and diffs to Cloudflare R2 on completion
- [ ] Gracefully pause/stop VMs on user command (save persistent disk)
- [ ] Resume VM from paused state

---

### Phase 2: Polish the core and make it stable.

#### DX and quality

- [ ] Add strict TypeScript rules
- [ ] Add ESLint
- [ ] Add Prettier or Biome
- [ ] Add barrel exports with `index.ts`
- [ ] Add file/folder naming conventions
- [ ] Keep files small and modular
- [ ] Add basic tests

#### Product improvements

- [ ] Add artifact viewer
- [ ] Add task history
- [ ] Add execution status badges
- [ ] Add better project creation flow
- [ ] Add model/provider settings page
- [ ] Add basic internal access gate if needed

#### Infra improvements

- [ ] Create VM startup scripts
- [ ] Add simple deploy scripts
- [ ] Add GCS only for uploads/artifacts/logs
- [ ] Add cleanup rules for old artifacts

---

### Later

Build the intelligent multi-agent system.

#### Orchestration

- [ ] Add **LangGraph**
- [ ] Build supervisor/orchestrator
- [ ] Add task classification:
  - [ ] single-agent mode
  - [ ] multi-agent mode

- [ ] Add task planner
- [ ] Add task splitter
- [ ] Add result merger

#### Specialized agents

- [ ] Add frontend agent
- [ ] Add backend agent
- [ ] Add tester agent
- [ ] Add research agent

#### Skills system

- [ ] Convert tools into reusable skills
- [ ] Add:
  - [ ] filesystem skill
  - [ ] shell skill
  - [ ] git skill
  - [ ] repo search skill
  - [ ] browser/research skill
  - [ ] verification skill

#### Parallel workflows

- [ ] Run frontend and backend agents in parallel
- [ ] Add file ownership boundaries
- [ ] Prevent collisions in shared files
- [ ] Add approval step for shared package edits
- [ ] Add verification pass before final output

#### UI mission control

- [ ] Show active agents
- [ ] Show per-agent progress cards
- [ ] Show agent logs
- [ ] Show merged final result
- [ ] Show review/approve flow

#### Phase 2 done when

- [ ] The system can decide when to use one agent or many
- [ ] Multiple agents can work safely in parallel
- [ ] The tester can verify results
- [ ] The orchestrator can merge outputs
- [ ] The UI clearly shows multi-agent progress

---

### Optional

Good additions, but not required at the start.

- [ ] Add Clerk or better auth later
- [ ] Add cost/token tracking dashboard
- [ ] Add branch-per-agent workflow
- [ ] Add snapshot/restore strategy
- [ ] Add preview deployment automation
- [ ] Add human approval checkpoints
- [ ] Add rollback/revert actions
- [ ] Add model routing by task type
- [ ] Add memory/context compression
- [ ] Add support for more providers besides Gemini

---

## Suggested stack

### Core

- **Bun**
- **Turborepo**
- **TypeScript**

### Frontend

- **Vite**
- **React**
- **Tailwind CSS**
- **shadcn/ui**

### Backend

- **Hono**
- **Zod**
- **Drizzle ORM** if needed

### Worker / AI

- **Gemini API**
- **LangGraph** later
- **LangChain / Deep Agents patterns** later

### Infra

- **GitHub** for source code
- **VM-based workspace**
- **GCS** for artifacts only
- optional **Cloud Run** for API
- optional **Cloud Run Jobs** for async jobs

## Best implementation order

1. **Monorepo**
2. **Web**
3. **Server**
4. **Worker**
5. **Workspace VM flow**
6. **Single coding agent**
7. **Streaming + artifacts**
8. **Provider/model settings**
9. **Orchestrator**
10. **Specialist agents**

Yes — I think **Morph is a very good fit as a fast specialist layer**, especially for **subagents/tools**, not as your only “brain.”

The cleanest setup is:

- **Gemini** = planner / supervisor / higher-level reasoning
- **Morph** = ultra-fast execution tools for narrow coding tasks

That matches how Morph positions itself: specialized models and task-specific inference for code editing, search, and related coding-agent work, rather than a single general-purpose orchestrator. Their docs describe **Fast Apply** for merging edits and **WarpGrep** for search, and the API is exposed through an **OpenAI-compatible endpoint** plus a TypeScript SDK. ([docs.morphllm.com][1])

## What I would use Morph for

Use Morph in your worker as a **subagent capability provider** for tasks like:

- **fast code search** → WarpGrep
- **fast code apply/edit merging** → Fast Apply
- optionally **browser/testing-related fast tasks** if you add that later

Morph’s docs say:

- **Fast Apply** is for merging code edits and is advertised at **10,500+ tokens/sec** with **98% accuracy**. ([docs.morphllm.com][2])
- **WarpGrep** is a code-search component, and Morph describes it as a search subagent/tool; their SDK docs also show it working in sandboxed environments and list pricing of **$0.80 per 1M input** and **$0.80 per 1M output tokens**. ([docs.morphllm.com][3])

So your intuition is right: **Morph makes sense for very fast subagent-style tasks.**

## What I would _not_ use Morph for first

I would **not** make Morph your main supervisor/orchestrator at the beginning.

Instead:

- keep **Gemini Pro / Flash** for:
  - planning
  - decomposition
  - deciding whether to spawn subagents
  - reviewing outputs
  - merging final answers

- use **Morph** for:
  - searching the repo quickly
  - applying edits quickly
  - maybe verification helpers later

That gives you the best of both:

- strong reasoning from Gemini
- high-speed mechanical work from Morph

## Best architecture for your project

Inside your worker, I’d add Morph like this:

```txt
apps/worker/src/
  providers/
    gemini/
    morph/
  skills/
    search/
    edit/
    git/
    shell/
  agents/
    coder/
    frontend/
    backend/
    tester/
  orchestrator/
```

And the routing idea is:

- **Supervisor agent** receives task
- decides:
  - simple task → one coder agent
  - larger task → frontend/backend/test agents

- each agent can call:
  - **Morph WarpGrep** for fast repo search
  - **Morph Fast Apply** for fast code application
  - shell/git tools for execution

## The best practical pattern

I would treat Morph as a **tool-backed accelerator**, not a separate “personality agent.”

So instead of saying:

- “Morph is another full agent”

I would say:

- “Frontend agent uses Morph search + apply tools”
- “Backend agent uses Morph search + apply tools”

That is simpler and stronger.

## Why this is a strong fit for your stack

Because Morph provides:

- a **TypeScript SDK** via `@morphllm/morphsdk`
- framework adapters for **OpenAI**, **Anthropic**, and **Vercel AI SDK**
- an API key-based setup through environment variables like `MORPH_API_KEY` ([docs.morphllm.com][3])

So it fits nicely into your:

- **TypeScript**
- **Bun**
- **worker-based**
- **tool/skills**
  architecture.

I would still do one small spike first, because their docs explicitly show `npm install` and Node-style usage, not a Bun-specific guide. The TS/Node compatibility story looks promising from the SDK examples, but I’d verify it in one isolated worker package before committing hard.

## My recommendation

Yes — **add Morph**.

But add it in this order:

1. **Phase 1**
   - keep Gemini as the main model
   - add Morph only for:
     - code search
     - code apply/edit

2. **Phase 2**
   - let orchestrator choose when specialist agents should use Morph-heavy flows
   - especially for backend/frontend subagents doing lots of file search and patching

## The simplest final design

- **Gemini Pro** → supervisor / complex reasoning
- **Gemini Flash / Flash Lite** → lighter agent turns
- **Morph WarpGrep** → fast repo search subagent/tool
- **Morph Fast Apply** → ultra-fast code edit application
- **Your own orchestrator** → decides when to use which

That is the setup I’d choose.

If you want, I can next sketch the exact `providers/morph` and `skills/edit` / `skills/search` folder structure for your worker.

[1]: https://docs.morphllm.com/?utm_source=chatgpt.com "Morph Documentation: Introduction"
[2]: https://docs.morphllm.com/api-reference/endpoint/apply "Apply API - Morph Documentation"
[3]: https://docs.morphllm.com/sdk/components/warp-grep "WarpGrep - Morph Documentation"

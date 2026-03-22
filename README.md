<div align="center">
  <h1>🌊 Vibecode</h1>
  <p><strong>A bounded, specialized AI engineering team. Inspired by OpenClaw.</strong></p>
</div>

---

Let’s get straight to it: **Vibecode is not another AI autocomplete or a glorified chat window.**

Inspired by the intelligence architecture of **[OpenClaw](https://docs.openclaw.ai/)**, Vibecode represents a fundamentally different approach to software development. It is a system driven by three core pillars: **Intelligence, a Persistent Memory Layer, and Deep Agent Orchestration.**

Instead of a generic assistant, think of Vibecode as your localized, specialized AI engineering team. It doesn't just guess the next line of code; it understands your architecture, executes tasks in a sandbox, and delivers production-ready artifacts.

---

## 🛠️ Core Capabilities

Most AI coding tools fail because they act as memory-less generalists. Vibecode succeeds by acting as a **bounded, specialized team**.

### 🧬 Deep Agent Orchestration
Powered by **LangChain** and **LangGraph**, we don't rely on fragile, single-shot LLM calls. Vibecode runs deep orchestration workflows where specialized agents—Frontend, Backend, Infrastructure—break down complex tickets, coordinate execution, and review each other's work.

### 🧠 Persistent Memory Layer
Context is everything. Vibecode features a robust memory layer that remembers your architectural decisions, past migrations, and project-specific conventions. You aren't teaching it from scratch every session; the team _learns_ your codebase and evolves alongside it.

### 🎯 Bounded, Specialized Focus
Generalist AI writes generic code. Vibecode uses _bounded_ agents. By constraining an agent's context to a highly specific domain (e.g., exclusively optimizing React render cycles or writing complex Drizzle SQL), we extract senior-level execution rather than junior-level boilerplate.

### ⚡ Real-Time Execution
Code is useless if it doesn't run. Vibecode streams its thought processes, writes code, and **executes it in real-time**. It can run scripts, read terminal outputs, and iterate on errors autonomously until the feature actually works.

### 📦 Tangible Artifact Generation
We don't do copy-paste code snippets. Vibecode generates complete, deployable **artifacts**—fully wired modules, interactive UI components, and backend services that drop seamlessly into your monorepo.

---

## 🏗️ The Engineering

Built for extreme performance, Vibecode is a **Turborepo** monorepo running entirely on **Bun** for maximum speed and DX.

- **Workspace (`apps/web`):** React 19, Vite, Tailwind CSS v4, Zustand.
- **Gateway (`apps/server`):** Hono (Edge-ready API & SSE Streaming).
- **Orchestration (`apps/worker`):** LangChain, LangGraph, Google Cloud Pub/Sub.
- **Data & Infra (`packages/*`):** Neon (Serverless Postgres), Drizzle ORM, Better Auth.

## 🚀 Spin Up Your Team

```bash
# Clone & Install
git clone https://github.com/jacksonkasi1/vibecode.git
cd vibecode
bun install

# Setup Environment
cp .env.example .env
bun run --filter @repo/db db:push

# Boot the System
bun run dev
```

---

## 📜 License

Vibecode is open-source and released under the **MIT License**, sharing the same licensing model as [OpenClaw](https://docs.openclaw.ai/). Free as a lobster in the ocean!

---

<div align="center">
  <h2>Stop fighting with autocomplete. Start commanding an engineering team.</h2>
  <p><i>The future of code isn't written. It's orchestrated.</i></p>
</div>

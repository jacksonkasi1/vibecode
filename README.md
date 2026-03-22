<div align="center">
  <h1>🌊 Vibecode</h1>
  <p><strong>A sophisticated AI-powered coding assistant and workspace platform.</strong></p>
</div>

---

## 🚀 Overview

Vibecode is a next-generation workspace designed for developers who want to collaborate seamlessly with AI. It moves beyond simple chat interfaces to provide a deep, agentic coding experience. Built on a robust, high-performance monorepo architecture, Vibecode handles complex multi-step reasoning, real-time code generation, and advanced file manipulation directly within the browser.

## ✨ Key Features

- **🧠 Deep Agent Orchestration:** Powered by **LangChain**, **LangGraph**, and **DeepAgents**, our worker instances run autonomous agents capable of exploring codebases, planning architectures, and executing multi-step coding tasks.
- **⚡ Real-Time Execution Streaming:** Enjoy zero-latency feedback with **SSE (Server-Sent Events)**. Watch code, terminal outputs, and AI thought processes stream live into your workspace.
- **📦 Artifact Generation:** Instantly generate complete files, UI components, or entire module scaffolds. The AI doesn't just suggest code; it builds tangible, deployable artifacts.
- **🔀 Advanced Diff & Merge:** Review AI-generated changes with precision. Includes intelligent diffing, **force merge** capabilities, and seamless **undo actions** to ensure you are always in complete control of your codebase.

## 🏗️ Architecture & Tech Stack

Vibecode is structured as a highly scalable **Turborepo** monorepo, powered by **Bun** for maximum performance.

### 🌐 Frontend (`apps/web`)

- **Framework:** React 19 + Vite + React Router DOM
- **Styling:** Tailwind CSS v4 + Radix UI
- **State & Data:** Zustand + React Query
- **Editor & UI:** Monaco Editor + Assistant UI

### ⚙️ API Server (`apps/server`)

- **Runtime:** Bun
- **Framework:** Hono (Edge-ready, lightning fast)
- **Validation:** Zod

### 🤖 AI Worker (`apps/worker`)

- **Orchestration:** LangChain, LangGraph, DeepAgents
- **Models:** Google GenAI / LLM Integrations
- **Messaging:** Google Cloud Pub/Sub for async job processing

### 💾 Data & Infrastructure (`packages/*`)

- **Database:** Neon (Serverless Postgres) + Drizzle ORM
- **Auth:** Better Auth
- **Tooling:** TypeScript 5.9, ESLint, Prettier

## 📂 Project Structure

```text
vibecode/
├── apps/
│   ├── web/        # The main React workspace and coding interface
│   ├── server/     # Hono-based API Gateway and SSE streaming server
│   └── worker/     # Heavy-lifting AI agents and LangGraph state machines
└── packages/
    ├── ai/         # Shared LLM tools, prompts, and agent configurations
    ├── auth/       # Better Auth configuration and identity flow
    ├── db/         # Drizzle schema, migrations, and database client
    └── shared/     # Common types, utilities, and constants
```

## 🏎️ Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/your-org/vibecode.git
cd vibecode

# 2. Install dependencies using Bun
bun install

# 3. Set up environment variables
cp .env.example .env

# 4. Push database schema
bun run --filter @repo/db db:push

# 5. Start the development environment (Web, Server, and Worker)
bun run dev
```

---

<div align="center">
  <i>Built for developers who want to code at the speed of thought.</i>
</div>

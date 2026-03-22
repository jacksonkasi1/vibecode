// ** import lib
import { db } from "@repo/db";
import { user, project, workspace, execution } from "@repo/db";
import { newId } from "@repo/db";

async function runTest() {
  console.warn("Looking for an existing user in the database...");
  const [existingUser] = await db.select().from(user).limit(1);

  if (!existingUser) {
    console.error(
      "❌ No users found in the database. Please sign up in the web app first.",
    );
    process.exit(1);
  }

  console.warn(`✅ Found user: ${existingUser.name} (${existingUser.email})`);

  console.warn("Creating default project...");
  const [testProject] = await db
    .insert(project)
    .values({
      id: newId(),
      userId: existingUser.id,
      name: "E2E Test Project",
      status: "active",
    })
    .returning();

  console.warn("Creating default workspace...");
  const [testWorkspace] = await db
    .insert(workspace)
    .values({
      id: newId(),
      projectId: testProject.id,
      name: "E2E Workspace",
      branch: "main",
      status: "idle",
    })
    .returning();

  console.warn("Creating execution (queued)...");
  const [testExec] = await db
    .insert(execution)
    .values({
      id: newId(),
      workspaceId: testWorkspace.id,
      userId: existingUser.id,
      prompt:
        "Write a short nodejs script that prints 'Hello VIBECode' to console, save it as hello.js, and then run it.",
      modelId: "gemini-2.5-pro",
      status: "queued",
    })
    .returning();

  console.warn(`✅ Execution created: ${testExec.id}`);
  console.warn(
    "Make sure your worker is running (`bun run dev`)! It should pick this up automatically.",
  );

  process.exit(0);
}

runTest().catch(console.error);

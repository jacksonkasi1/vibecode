import { describe, expect, it } from "bun:test";

import { buildTaskGraph } from "../src/lib/task-graph";

describe("buildTaskGraph", () => {
  it("preserves dependency ordering", () => {
    const graph = buildTaskGraph({
      isSingleAgent: false,
      tasks: [
        {
          id: "task-1",
          description: "First",
          prompt: "First",
          agentName: "coder",
          fileOwnership: ["a"],
        },
        {
          id: "task-2",
          dependsOn: ["task-1"],
          description: "Second",
          prompt: "Second",
          agentName: "backend",
          fileOwnership: ["b"],
        },
      ],
    });

    expect(graph.orderedTasks.map((task) => task.id)).toEqual([
      "task-1",
      "task-2",
    ]);
    expect(graph.parallelGroups).toHaveLength(2);
  });
});

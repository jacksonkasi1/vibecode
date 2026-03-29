// ** import types
import type { TaskPlan } from "./task-planner";

export interface PlannedTaskNode {
  id: string;
  description: string;
  prompt: string;
  agentName: TaskPlan["tasks"][number]["agentName"];
  fileOwnership: string[];
  dependsOn: string[];
}

export interface TaskGraphResult {
  orderedTasks: PlannedTaskNode[];
  parallelGroups: PlannedTaskNode[][];
}

export function buildTaskGraph(plan: TaskPlan): TaskGraphResult {
  const nodes: PlannedTaskNode[] = plan.tasks.map((task, index) => ({
    id: task.id ?? `task-${index + 1}`,
    description: task.description,
    prompt: task.prompt,
    agentName: task.agentName,
    fileOwnership: task.fileOwnership,
    dependsOn: task.dependsOn ?? [],
  }));

  if (nodes.length <= 1) {
    return {
      orderedTasks: nodes,
      parallelGroups: nodes.length ? [nodes] : [],
    };
  }

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const indegree = new Map(nodes.map((node) => [node.id, 0]));

  for (const node of nodes) {
    for (const dependencyId of node.dependsOn) {
      if (byId.has(dependencyId)) {
        indegree.set(node.id, (indegree.get(node.id) ?? 0) + 1);
      }
    }
  }

  const orderedTasks: PlannedTaskNode[] = [];
  const parallelGroups: PlannedTaskNode[][] = [];
  let frontier = nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0);

  while (frontier.length > 0) {
    parallelGroups.push(frontier);
    orderedTasks.push(...frontier);

    const completedIds = new Set(frontier.map((node) => node.id));
    const nextFrontier: PlannedTaskNode[] = [];

    for (const node of nodes) {
      if (orderedTasks.some((ordered) => ordered.id === node.id)) {
        continue;
      }

      let remaining = indegree.get(node.id) ?? 0;
      for (const dependencyId of node.dependsOn) {
        if (completedIds.has(dependencyId)) {
          remaining -= 1;
        }
      }
      indegree.set(node.id, remaining);

      if (remaining === 0) {
        nextFrontier.push(node);
      }
    }

    frontier = nextFrontier;
  }

  if (orderedTasks.length !== nodes.length) {
    return {
      orderedTasks: nodes,
      parallelGroups: nodes.map((node) => [node]),
    };
  }

  return {
    orderedTasks,
    parallelGroups,
  };
}

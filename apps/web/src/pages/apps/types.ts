// ** import types
import type { Project, Workspace } from "@repo/db";

export type AppsMode = "Agent" | "Plan";

export type RecentProjectItem = {
  project: Project;
  workspace?: Workspace;
};

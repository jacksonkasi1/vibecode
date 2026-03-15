// ** import config
import axiosInstance from "@/config/axios";

// ** import types
import type { Workspace } from "@repo/db";

export interface CreateWorkspaceParams {
  projectId: string;
  name: string;
  branch?: string;
}

export interface CreateWorkspaceResponse {
  data: Workspace;
}

/**
 * Create a new workspace for a project
 *
 * @param data - Workspace creation parameters
 * @returns Promise with created workspace data
 */
export const createWorkspace = async (
  data: CreateWorkspaceParams,
): Promise<CreateWorkspaceResponse> => {
  const response = await axiosInstance.post<CreateWorkspaceResponse>(
    "/api/workspaces",
    data,
  );

  return response.data;
};

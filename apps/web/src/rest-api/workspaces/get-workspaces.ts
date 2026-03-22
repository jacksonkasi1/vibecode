// ** import config
import axiosInstance from "@/config/axios";

// ** import types
import type { Workspace } from "@repo/db";

export interface GetWorkspacesResponse {
  data: Workspace[];
}

/**
 * Retrieve list of workspaces, optionally filtered by project ID
 *
 * @param projectId - Optional project ID to filter workspaces
 * @returns Promise with array of workspaces
 */
export const getWorkspaces = async (
  projectId?: string,
): Promise<GetWorkspacesResponse> => {
  const url = projectId
    ? `/api/workspaces?projectId=${projectId}`
    : "/api/workspaces";
  const response = await axiosInstance.get<GetWorkspacesResponse>(url);

  return response.data;
};

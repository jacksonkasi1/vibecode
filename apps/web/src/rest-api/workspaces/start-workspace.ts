// ** import config
import axiosInstance from "@/config/axios";

// ** import types
import type { Workspace } from "@repo/db";

export interface StartWorkspaceResponse {
  data: Workspace;
}

/**
 * Start a workspace virtual machine or environment
 *
 * @param workspaceId - The unique identifier of the workspace to start
 * @returns Promise with starting workspace data
 */
export const startWorkspace = async (
  workspaceId: string,
): Promise<StartWorkspaceResponse> => {
  const response = await axiosInstance.post<StartWorkspaceResponse>(
    `/api/workspaces/${workspaceId}/start`,
  );

  return response.data;
};

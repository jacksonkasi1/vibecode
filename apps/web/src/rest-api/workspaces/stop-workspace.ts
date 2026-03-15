// ** import config
import axiosInstance from "@/config/axios";

// ** import types
import type { Workspace } from "@repo/db";

export interface StopWorkspaceResponse {
  data: Workspace;
}

/**
 * Stop a workspace virtual machine or environment
 *
 * @param workspaceId - The unique identifier of the workspace to stop
 * @returns Promise with stopping workspace data
 */
export const stopWorkspace = async (
  workspaceId: string,
): Promise<StopWorkspaceResponse> => {
  const response = await axiosInstance.post<StopWorkspaceResponse>(
    `/api/workspaces/${workspaceId}/stop`,
  );

  return response.data;
};

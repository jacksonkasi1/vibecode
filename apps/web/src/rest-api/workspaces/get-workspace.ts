// ** import config
import axiosInstance from "@/config/axios";

// ** import types
import type { Workspace } from "@repo/db";

export interface GetWorkspaceResponse {
  data: Workspace;
}

/**
 * Retrieve a specific workspace by ID
 *
 * @param workspaceId - The unique identifier of the workspace
 * @returns Promise with workspace data
 */
export const getWorkspace = async (
  workspaceId: string,
): Promise<GetWorkspaceResponse> => {
  const response = await axiosInstance.get<GetWorkspaceResponse>(
    `/api/workspaces/${workspaceId}`,
  );

  return response.data;
};

// ** import config
import axiosInstance from "@/config/axios";

// ** import types
import type { Workspace } from "@repo/db";

export interface UpdateWorkspaceParams {
  name?: string;
  branch?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateWorkspaceResponse {
  data: Workspace;
}

/**
 * Update an existing workspace
 *
 * @param workspaceId - The unique identifier of the workspace
 * @param data - The workspace fields to update
 * @returns Promise with updated workspace data
 */
export const updateWorkspace = async (
  workspaceId: string,
  data: UpdateWorkspaceParams,
): Promise<UpdateWorkspaceResponse> => {
  const response = await axiosInstance.patch<UpdateWorkspaceResponse>(
    `/api/workspaces/${workspaceId}`,
    data,
  );

  return response.data;
};

// ** import config
import axiosInstance from "@/config/axios";

// ** import types
import type { ChatThread } from "@repo/db";

export interface GetThreadsResponse {
  data: ChatThread[];
}

/**
 * Retrieve list of threads for a workspace
 *
 * @param workspaceId - Workspace ID to filter threads
 * @returns Promise with array of threads
 */
export const getThreads = async (
  workspaceId: string,
): Promise<GetThreadsResponse> => {
  const response = await axiosInstance.get<GetThreadsResponse>(
    `/api/threads?workspaceId=${workspaceId}`,
  );

  return response.data;
};

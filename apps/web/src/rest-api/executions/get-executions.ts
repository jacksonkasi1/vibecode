// ** import config
import axiosInstance from "@/config/axios";

// ** import types
import type { Execution } from "@repo/db";

export interface GetExecutionsResponse {
  data: Execution[];
}

/**
 * Retrieve list of executions, optionally filtered by workspace ID
 *
 * @param workspaceId - Optional workspace ID to filter executions
 * @returns Promise with array of executions
 */
export const getExecutions = async (
  workspaceId?: string,
): Promise<GetExecutionsResponse> => {
  const url = workspaceId
    ? `/api/executions?workspaceId=${workspaceId}`
    : "/api/executions";
  const response = await axiosInstance.get<GetExecutionsResponse>(url);

  return response.data;
};

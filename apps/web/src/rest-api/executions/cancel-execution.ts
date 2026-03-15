// ** import config
import axiosInstance from "@/config/axios";

// ** import types
import type { Execution } from "@repo/db";

export interface CancelExecutionResponse {
  data: Execution;
}

/**
 * Cancel a specific execution by ID
 *
 * @param executionId - The unique identifier of the execution
 * @returns Promise with cancelled execution data
 */
export const cancelExecution = async (
  executionId: string,
): Promise<CancelExecutionResponse> => {
  const response = await axiosInstance.post<CancelExecutionResponse>(
    `/api/executions/${executionId}/cancel`,
  );

  return response.data;
};

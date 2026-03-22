// ** import config
import axiosInstance from "@/config/axios";

// ** import types
import type { Execution } from "@repo/db";

export interface ForceMergeExecutionResponse {
  data: Execution;
}

/**
 * Force-merge a conflicted execution using "ours" strategy (this execution wins)
 *
 * @param executionId - The unique identifier of the conflicted execution
 * @returns Promise with the updated execution data
 */
export const forceMergeExecution = async (
  executionId: string,
): Promise<ForceMergeExecutionResponse> => {
  const response = await axiosInstance.post<ForceMergeExecutionResponse>(
    `/api/executions/${executionId}/force-merge`,
  );

  return response.data;
};

// ** import config
import axiosInstance from "@/config/axios";

// ** import types
import type { Execution } from "@repo/db";

export interface GetExecutionResponse {
  data: Execution;
}

/**
 * Retrieve a specific execution by ID
 *
 * @param executionId - The unique identifier of the execution
 * @returns Promise with execution data
 */
export const getExecution = async (
  executionId: string,
): Promise<GetExecutionResponse> => {
  const response = await axiosInstance.get<GetExecutionResponse>(
    `/api/executions/${executionId}`,
  );

  return response.data;
};

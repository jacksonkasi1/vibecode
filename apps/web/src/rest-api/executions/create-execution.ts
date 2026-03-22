// ** import config
import axiosInstance from "@/config/axios";

// ** import types
import type { Execution } from "@repo/db";

export interface CreateExecutionParams {
  workspaceId: string;
  prompt: string;
  modelId?: string;
  threadId?: string;
  editorContext?: {
    activeFilePath?: string;
    visibleContent?: string;
  };
}

export interface CreateExecutionResponse {
  data: Execution;
}

/**
 * Create a new task/execution
 *
 * @param data - Execution creation parameters
 * @returns Promise with created execution data
 */
export const createExecution = async (
  data: CreateExecutionParams,
): Promise<CreateExecutionResponse> => {
  const response = await axiosInstance.post<CreateExecutionResponse>(
    "/api/executions",
    data,
  );

  return response.data;
};

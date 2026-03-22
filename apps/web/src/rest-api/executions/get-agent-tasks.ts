// ** import config
import axiosInstance from "@/config/axios";

// ** import types
import type { AgentTask } from "@repo/db";

export interface GetAgentTasksResponse {
  data: AgentTask[];
}

export interface GetAgentTaskResponse {
  data: AgentTask;
}

/**
 * Retrieve all agent tasks spawned by an execution.
 *
 * @param executionId - The parent execution ID
 * @returns Promise with list of agent tasks
 */
export const getAgentTasks = async (
  executionId: string,
): Promise<GetAgentTasksResponse> => {
  const response = await axiosInstance.get<GetAgentTasksResponse>(
    `/api/executions/${executionId}/agents`,
  );
  return response.data;
};

/**
 * Retrieve a specific agent task.
 *
 * @param executionId - The parent execution ID
 * @param taskId - The agent task ID
 * @returns Promise with agent task data
 */
export const getAgentTask = async (
  executionId: string,
  taskId: string,
): Promise<GetAgentTaskResponse> => {
  const response = await axiosInstance.get<GetAgentTaskResponse>(
    `/api/executions/${executionId}/agents/${taskId}`,
  );
  return response.data;
};

// ** import config
import axiosInstance from "@/config/axios";

export interface UndoExecutionResponse {
  data: { success: boolean };
}

/**
 * Undo changes to a specific execution state
 *
 * @param executionId - The ID of the execution to revert to
 * @returns Promise with undo result
 */
export const undoExecution = async (
  executionId: string,
): Promise<UndoExecutionResponse> => {
  const response = await axiosInstance.post<UndoExecutionResponse>(
    `/api/executions/${executionId}/undo`,
  );

  return response.data;
};

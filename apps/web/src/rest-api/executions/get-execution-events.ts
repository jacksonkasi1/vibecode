// ** import config
import axiosInstance from "@/config/axios";

// ** import types
import type { ExecutionEvent } from "@repo/db";

export interface GetExecutionEventsResponse {
  data: ExecutionEvent[];
}

export const getExecutionEvents = async (
  executionId: string,
): Promise<GetExecutionEventsResponse> => {
  const response = await axiosInstance.get<GetExecutionEventsResponse>(
    `/api/executions/${executionId}/events`,
  );

  return response.data;
};

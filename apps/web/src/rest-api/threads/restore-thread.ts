// ** import config
import axiosInstance from "@/config/axios";

// ** import types
import type { ChatThread } from "@repo/db";

export interface RestoreThreadResponse {
  data: ChatThread;
}

export const restoreThread = async (
  threadId: string,
): Promise<RestoreThreadResponse> => {
  const response = await axiosInstance.post<RestoreThreadResponse>(
    `/api/threads/${threadId}/restore`,
  );

  return response.data;
};

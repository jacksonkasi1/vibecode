// ** import config
import axiosInstance from "@/config/axios";

// ** import types
import type { ChatThread } from "@repo/db";

export interface DeleteThreadResponse {
  data: ChatThread;
}

export const deleteThread = async (
  threadId: string,
): Promise<DeleteThreadResponse> => {
  const response = await axiosInstance.delete<DeleteThreadResponse>(
    `/api/threads/${threadId}`,
  );

  return response.data;
};

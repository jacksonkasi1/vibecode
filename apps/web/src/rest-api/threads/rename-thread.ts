// ** import config
import axiosInstance from "@/config/axios";

// ** import types
import type { ChatThread } from "@repo/db";

export interface RenameThreadResponse {
  data: ChatThread;
}

export const renameThread = async (
  threadId: string,
  title: string,
): Promise<RenameThreadResponse> => {
  const response = await axiosInstance.patch<RenameThreadResponse>(
    `/api/threads/${threadId}`,
    { title },
  );

  return response.data;
};

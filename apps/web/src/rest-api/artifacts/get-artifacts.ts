// ** import config
import axiosInstance from "@/config/axios";

// ** import types
import type { Artifact } from "@repo/db";

export interface GetArtifactsResponse {
  data: Artifact[];
}

/**
 * Retrieve list of artifacts for an execution
 *
 * @param executionId - Execution ID to filter artifacts
 * @returns Promise with array of artifacts
 */
export const getArtifacts = async (
  executionId: string,
): Promise<GetArtifactsResponse> => {
  const response = await axiosInstance.get<GetArtifactsResponse>(
    `/api/artifacts?executionId=${executionId}`,
  );

  return response.data;
};

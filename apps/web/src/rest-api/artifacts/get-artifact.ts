// ** import config
import axiosInstance from "@/config/axios";

// ** import types
import type { Artifact } from "@repo/db";

export interface GetArtifactResponse {
  data: Artifact;
}

/**
 * Retrieve a specific artifact by ID
 *
 * @param artifactId - The unique identifier of the artifact
 * @returns Promise with artifact data
 */
export const getArtifact = async (
  artifactId: string,
): Promise<GetArtifactResponse> => {
  const response = await axiosInstance.get<GetArtifactResponse>(
    `/api/artifacts/${artifactId}`,
  );

  return response.data;
};

// ** import config
import axiosInstance from "@/config/axios";

// ** import types
import type { Project } from "@repo/db";

export interface GetProjectResponse {
  data: Project;
}

/**
 * Retrieve a specific project by ID
 *
 * @param projectId - The unique identifier of the project
 * @returns Promise with project data
 */
export const getProject = async (
  projectId: string,
): Promise<GetProjectResponse> => {
  const response = await axiosInstance.get<GetProjectResponse>(
    `/api/projects/${projectId}`,
  );

  return response.data;
};

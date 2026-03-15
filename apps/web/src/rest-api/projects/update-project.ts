// ** import config
import axiosInstance from "@/config/axios";

// ** import types
import type { Project } from "@repo/db";

export interface UpdateProjectParams {
  name?: string;
  description?: string;
  repositoryUrl?: string;
  defaultBranch?: string;
  status?: "active" | "archived" | "deleted";
}

export interface UpdateProjectResponse {
  data: Project;
}

/**
 * Update an existing project
 *
 * @param projectId - The unique identifier of the project
 * @param data - The project fields to update
 * @returns Promise with updated project data
 */
export const updateProject = async (
  projectId: string,
  data: UpdateProjectParams,
): Promise<UpdateProjectResponse> => {
  const response = await axiosInstance.patch<UpdateProjectResponse>(
    `/api/projects/${projectId}`,
    data,
  );

  return response.data;
};

// ** import config
import axiosInstance from "@/config/axios";

// ** import types
import type { Project } from "@repo/db";

export interface DeleteProjectResponse {
  data: Project;
}

/**
 * Delete a specific project by ID (soft delete via status update)
 *
 * @param projectId - The unique identifier of the project
 * @returns Promise with deleted project data
 */
export const deleteProject = async (
  projectId: string,
): Promise<DeleteProjectResponse> => {
  const response = await axiosInstance.delete<DeleteProjectResponse>(
    `/api/projects/${projectId}`,
  );

  return response.data;
};

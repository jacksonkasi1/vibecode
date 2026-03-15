// ** import config
import axiosInstance from "@/config/axios";

// ** import types
import type { Project } from "@repo/db";

export interface CreateProjectParams {
  name: string;
  description?: string;
  repositoryUrl?: string;
  defaultBranch?: string;
}

export interface CreateProjectResponse {
  data: Project;
}

/**
 * Create a new project
 *
 * @param data - Project creation parameters
 * @returns Promise with created project data
 */
export const createProject = async (
  data: CreateProjectParams,
): Promise<CreateProjectResponse> => {
  const response = await axiosInstance.post<CreateProjectResponse>(
    "/api/projects",
    data,
  );

  return response.data;
};

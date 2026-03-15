// ** import config
import axiosInstance from "@/config/axios";

// ** import types
import type { Project } from "@repo/db";

export interface GetProjectsResponse {
  data: Project[];
}

/**
 * Retrieve list of projects
 *
 * @returns Promise with array of projects
 */
export const getProjects = async (): Promise<GetProjectsResponse> => {
  const response = await axiosInstance.get<GetProjectsResponse>("/api/projects");

  return response.data;
};

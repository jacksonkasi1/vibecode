// ** import config
import axiosInstance from "@/config/axios";

// ** import types
import type { ModelProvider } from "@repo/db";

export interface GetProvidersResponse {
  data: ModelProvider[];
}

/**
 * Retrieve list of all available AI model providers
 *
 * @returns Promise with array of providers
 */
export const getProviders = async (): Promise<GetProvidersResponse> => {
  const response = await axiosInstance.get<GetProvidersResponse>("/api/models/providers");

  return response.data;
};

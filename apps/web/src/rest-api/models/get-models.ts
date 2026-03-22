// ** import config
import axiosInstance from "@/config/axios";

// ** import types
import type { ModelConfig } from "@repo/db";

export interface GetModelsResponse {
  data: ModelConfig[];
}

/**
 * Retrieve list of all available models, optionally filtered by provider ID
 *
 * @param providerId - Optional provider ID to filter models
 * @returns Promise with array of models
 */
export const getModels = async (
  providerId?: string,
): Promise<GetModelsResponse> => {
  const url = providerId
    ? `/api/models?providerId=${providerId}`
    : "/api/models";
  const response = await axiosInstance.get<GetModelsResponse>(url);

  return response.data;
};

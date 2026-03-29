export interface QuickExecutionRequest {
  projectId: string;
  command: string;
  env: Record<string, string>;
}

export interface QuickExecutionResult {
  strategy: "cloud_run";
  accepted: boolean;
  message: string;
}

export async function dispatchCloudRunJob(
  request: QuickExecutionRequest,
): Promise<QuickExecutionResult> {
  return {
    strategy: "cloud_run",
    accepted: false,
    message: `Cloud Run execution adapter is scaffolded but not active yet for project ${request.projectId}.`,
  };
}

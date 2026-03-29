// ** import core packages
import { Index } from "@upstash/vector";

export type KnowledgeRecordType =
  | "architecture"
  | "code_structure"
  | "convention"
  | "decision"
  | "error_pattern"
  | "plan"
  | "user_context";

export interface KnowledgeMetadata {
  [key: string]: string | number | boolean | undefined;
  projectId?: string;
  userId: string;
  workspaceId?: string;
  executionId?: string;
  commitSha?: string;
  filePath?: string;
  type: KnowledgeRecordType;
  source: string;
  summary: string;
  createdAt: number;
  updatedAt: number;
}

export interface VectorRecord {
  id: string;
  vector: number[];
  data?: string;
  metadata: KnowledgeMetadata;
}

export interface VectorSearchQuery {
  vector?: number[];
  data?: string;
  topK?: number;
  filter?: string;
  includeMetadata?: boolean;
  includeData?: boolean;
}

function createVectorIndex(config?: { url?: string; token?: string }) {
  const url = config?.url ?? process.env.UPSTASH_VECTOR_REST_URL;
  const token = config?.token ?? process.env.UPSTASH_VECTOR_REST_TOKEN;

  if (!url || !token) {
    throw new Error("Missing Upstash Vector credentials");
  }

  return new Index<KnowledgeMetadata>({ url, token });
}

function getVectorNamespace(namespace?: string) {
  const index = createVectorIndex();

  if (namespace) {
    return index.namespace(namespace);
  }

  return index;
}

export async function upsertVectors(
  records: VectorRecord[],
  namespace?: string,
) {
  if (!records.length) {
    return;
  }

  const index = getVectorNamespace(namespace);
  await index.upsert(
    records.map((record) => ({
      id: record.id,
      vector: record.vector,
      ...(record.data ? { data: record.data } : {}),
      metadata: record.metadata,
    })),
  );
}

export async function queryVectors(
  query: VectorSearchQuery,
  namespace?: string,
) {
  const index = getVectorNamespace(namespace);

  if (query.vector) {
    return index.query({
      vector: query.vector,
      topK: query.topK ?? 8,
      filter: query.filter,
      includeMetadata: query.includeMetadata ?? true,
      includeData: query.includeData ?? true,
    });
  }

  if (query.data) {
    return index.query({
      data: query.data,
      topK: query.topK ?? 8,
      filter: query.filter,
      includeMetadata: query.includeMetadata ?? true,
      includeData: query.includeData ?? true,
    });
  }

  throw new Error("Vector query requires either vector or data input");
}

export async function deleteVectors(ids: string[], namespace?: string) {
  if (!ids.length) {
    return;
  }

  const index = getVectorNamespace(namespace);

  await Promise.all(ids.map((id) => index.delete(id)));
}

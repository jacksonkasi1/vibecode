// ** import core packages
import { GoogleGenAI } from "@google/genai";

const EMBEDDING_MODEL = "text-embedding-004";
const EMBEDDING_DIMENSIONS = 768;

let client: GoogleGenAI | null = null;

function getClient() {
  if (client) {
    return client;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY for embedding generation");
  }

  client = new GoogleGenAI({ apiKey });
  return client;
}

export interface EmbeddingResult {
  content: string;
  vector: number[];
}

export async function generateEmbeddings(contents: string[]) {
  if (!contents.length) {
    return [] satisfies EmbeddingResult[];
  }

  const response = await getClient().models.embedContent({
    model: EMBEDDING_MODEL,
    contents,
    config: {
      outputDimensionality: EMBEDDING_DIMENSIONS,
      taskType: "RETRIEVAL_DOCUMENT",
    },
  });

  return contents.map((content, index) => ({
    content,
    vector: response.embeddings?.[index]?.values ?? [],
  }));
}

export async function generateQueryEmbedding(content: string) {
  const response = await getClient().models.embedContent({
    model: EMBEDDING_MODEL,
    contents: [content],
    config: {
      outputDimensionality: EMBEDDING_DIMENSIONS,
      taskType: "RETRIEVAL_QUERY",
    },
  });

  return response.embeddings?.[0]?.values ?? [];
}

export { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL };

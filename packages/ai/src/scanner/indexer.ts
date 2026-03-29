// ** import embeddings
import {
  chunkMarkdownByHeading,
  chunkTextByLines,
  generateEmbeddings,
} from "../embeddings";

// ** import utils
import type { RepositoryFile } from "./detector";

export interface IndexedRepositoryChunk {
  id: string;
  path: string;
  summary: string;
  content: string;
  startLine: number;
  endLine: number;
  vector: number[];
}

function isMarkdown(path: string) {
  return path.endsWith(".md") || path.endsWith(".mdx");
}

export async function indexRepositoryFiles(files: RepositoryFile[]) {
  const chunkInputs = files.flatMap((file) => {
    if (!file.content?.trim()) {
      return [];
    }

    return isMarkdown(file.path)
      ? chunkMarkdownByHeading({ source: file.path, content: file.content })
      : chunkTextByLines({ source: file.path, content: file.content });
  });

  if (!chunkInputs.length) {
    return [] satisfies IndexedRepositoryChunk[];
  }

  const embeddings = await generateEmbeddings(
    chunkInputs.map((chunk) => chunk.content),
  );

  return chunkInputs.map(
    (chunk, index) =>
      ({
        id: chunk.id,
        path: chunk.source,
        summary: chunk.summary,
        content: chunk.content,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        vector: embeddings[index]?.vector ?? [],
      }) satisfies IndexedRepositoryChunk,
  );
}

export interface ChunkedContent {
  id: string;
  content: string;
  summary: string;
  startLine: number;
  endLine: number;
  source: string;
}

const DEFAULT_MAX_LINES = 60;
const DEFAULT_SUMMARY_LENGTH = 180;

function createSummary(content: string) {
  return content.replace(/\s+/g, " ").trim().slice(0, DEFAULT_SUMMARY_LENGTH);
}

export function chunkTextByLines(input: {
  source: string;
  content: string;
  maxLines?: number;
}) {
  const maxLines = input.maxLines ?? DEFAULT_MAX_LINES;
  const lines = input.content.split(/\r?\n/);
  const chunks: ChunkedContent[] = [];

  for (let index = 0; index < lines.length; index += maxLines) {
    const slice = lines.slice(index, index + maxLines);
    const content = slice.join("\n").trim();

    if (!content) {
      continue;
    }

    chunks.push({
      id: `${input.source}:${index + 1}`,
      content,
      summary: createSummary(content),
      startLine: index + 1,
      endLine: Math.min(index + maxLines, lines.length),
      source: input.source,
    });
  }

  return chunks;
}

export function chunkMarkdownByHeading(input: {
  source: string;
  content: string;
}) {
  const sections = input.content.split(/\n(?=#)/g);

  if (sections.length <= 1) {
    return chunkTextByLines({ source: input.source, content: input.content });
  }

  let lineCursor = 1;

  return sections
    .map((section, index) => {
      const lineCount = section.split(/\r?\n/).length;
      const chunk = {
        id: `${input.source}:section:${index + 1}`,
        content: section.trim(),
        summary: createSummary(section),
        startLine: lineCursor,
        endLine: lineCursor + lineCount - 1,
        source: input.source,
      } satisfies ChunkedContent;

      lineCursor += lineCount;

      return chunk.content ? chunk : null;
    })
    .filter((chunk): chunk is ChunkedContent => Boolean(chunk));
}

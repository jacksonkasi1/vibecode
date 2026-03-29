import { describe, expect, it } from "bun:test";

import {
  chunkMarkdownByHeading,
  chunkTextByLines,
} from "../src/embeddings/chunker";

describe("chunker", () => {
  it("chunks line-based content with summaries", () => {
    const chunks = chunkTextByLines({
      source: "src/example.ts",
      content: "line1\nline2\nline3",
      maxLines: 2,
    });

    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.startLine).toBe(1);
    expect(chunks[1]?.startLine).toBe(3);
  });

  it("chunks markdown by headings", () => {
    const chunks = chunkMarkdownByHeading({
      source: "README.md",
      content: "# Intro\nhello\n## Details\nmore",
    });

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0]?.source).toBe("README.md");
  });
});

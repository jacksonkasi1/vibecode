/**
 * Basic token estimation utility.
 * Uses a rough approximation of ~4 characters per token.
 * For accurate counts, use the provider's tokenizer.
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

export function estimateMessagesTokenCount(
  messages: { content: string }[],
): number {
  return messages.reduce(
    (sum, msg) => sum + estimateTokenCount(msg.content),
    0,
  );
}

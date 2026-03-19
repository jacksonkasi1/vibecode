// ** import utils
import { logger } from "@repo/logs";

export const RETRY_INITIAL_DELAY = 2_000;
export const RETRY_BACKOFF_FACTOR = 2;
export const RETRY_MAX_DELAY_NO_HEADERS = 30_000;
export const RETRY_MAX_DELAY = 2_147_483_647; // max 32-bit signed int

export type RetryableError = {
  isRetryable: boolean;
  isFatal: boolean;
  isContextOverflow: boolean;
  isCancelled: boolean;
  retryAfterMs?: number;
  message: string;
};

/**
 * Parse an HTTP error response and classify it for retry logic.
 * Returns null if the error object is unrecognizable.
 */
export function classifyError(error: unknown): RetryableError {
  const message =
    error instanceof Error ? error.message : String(error ?? "Unknown error");
  const lower = message.toLowerCase();

  // Cancelled / aborted — never retry
  if (lower.includes("abort") || lower.includes("cancel")) {
    return {
      isRetryable: false,
      isFatal: false,
      isCancelled: true,
      isContextOverflow: false,
      message,
    };
  }

  // Context / token overflow — do NOT retry, needs compaction
  if (
    lower.includes("context") ||
    lower.includes("token") ||
    lower.includes("too long") ||
    lower.includes("maximum context") ||
    lower.includes("context_length_exceeded") ||
    lower.includes("request too large")
  ) {
    return {
      isRetryable: false,
      isFatal: false,
      isCancelled: false,
      isContextOverflow: true,
      message,
    };
  }

  // Auth errors — fatal, never retry
  if (
    lower.includes("api key") ||
    lower.includes("unauthorized") ||
    lower.includes("forbidden") ||
    lower.includes("invalid_api_key") ||
    lower.includes("authentication") ||
    (lower.includes("401") && !lower.includes("retry"))
  ) {
    return {
      isRetryable: false,
      isFatal: true,
      isCancelled: false,
      isContextOverflow: false,
      message,
    };
  }

  // Rate limit (429) — retryable
  if (
    lower.includes("429") ||
    lower.includes("rate limit") ||
    lower.includes("rate_limit") ||
    lower.includes("too many requests") ||
    lower.includes("quota exceeded") ||
    lower.includes("resource_exhausted")
  ) {
    const retryAfterMs = extractRetryAfterMs(error);
    return {
      isRetryable: true,
      isFatal: false,
      isCancelled: false,
      isContextOverflow: false,
      retryAfterMs,
      message,
    };
  }

  // Overloaded / service unavailable (503) — retryable
  if (
    lower.includes("503") ||
    lower.includes("overload") ||
    lower.includes("service unavailable") ||
    lower.includes("temporarily unavailable") ||
    lower.includes("server error") ||
    lower.includes("500") ||
    lower.includes("502")
  ) {
    return {
      isRetryable: true,
      isFatal: false,
      isCancelled: false,
      isContextOverflow: false,
      message,
    };
  }

  // Network errors — retryable
  if (
    lower.includes("econnreset") ||
    lower.includes("econnrefused") ||
    lower.includes("etimedout") ||
    lower.includes("network") ||
    lower.includes("socket") ||
    lower.includes("fetch failed")
  ) {
    return {
      isRetryable: true,
      isFatal: false,
      isCancelled: false,
      isContextOverflow: false,
      message,
    };
  }

  // Default: not retryable, not fatal (unknown error)
  return {
    isRetryable: false,
    isFatal: false,
    isCancelled: false,
    isContextOverflow: false,
    message,
  };
}

function extractRetryAfterMs(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;

  const maybeHeaders = (error as Record<string, unknown>).headers;
  if (!maybeHeaders || typeof maybeHeaders !== "object") return undefined;

  const headers = maybeHeaders as Record<string, string>;

  const retryAfterMs = headers["retry-after-ms"];
  if (retryAfterMs) {
    const parsed = Number.parseFloat(retryAfterMs);
    if (!Number.isNaN(parsed)) return parsed;
  }

  const retryAfter = headers["retry-after"];
  if (retryAfter) {
    const parsedSeconds = Number.parseFloat(retryAfter);
    if (!Number.isNaN(parsedSeconds)) return Math.ceil(parsedSeconds * 1000);

    const parsedDate = Date.parse(retryAfter) - Date.now();
    if (!Number.isNaN(parsedDate) && parsedDate > 0)
      return Math.ceil(parsedDate);
  }

  return undefined;
}

/**
 * Calculate exponential backoff delay for a given attempt number.
 * Uses Retry-After headers when available.
 */
export function computeDelay(attempt: number, error?: unknown): number {
  const retryAfterMs = extractRetryAfterMs(error);
  if (retryAfterMs !== undefined) {
    return Math.min(retryAfterMs, RETRY_MAX_DELAY);
  }
  return Math.min(
    RETRY_INITIAL_DELAY * Math.pow(RETRY_BACKOFF_FACTOR, attempt - 1),
    RETRY_MAX_DELAY_NO_HEADERS,
  );
}

/**
 * Sleep for a given number of milliseconds with optional abort signal.
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const capped = Math.min(ms, RETRY_MAX_DELAY);

    const abortHandler = () => {
      clearTimeout(timeout);
      reject(new DOMException("Aborted", "AbortError"));
    };

    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", abortHandler);
      resolve();
    }, capped);

    signal?.addEventListener("abort", abortHandler, { once: true });
  });
}

const MAX_RETRY_ATTEMPTS = 5;

/**
 * Execute an async function with automatic retry on transient errors.
 *
 * @param fn - The async function to retry
 * @param options.onRetry - Called before each retry with attempt number and error
 * @param options.signal - AbortSignal to cancel retries
 * @param options.maxAttempts - Override max retry attempts (default: 5)
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: {
    onRetry?: (attempt: number, error: RetryableError, delayMs: number) => void;
    signal?: AbortSignal;
    maxAttempts?: number;
  },
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? MAX_RETRY_ATTEMPTS;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const classified = classifyError(err);

      if (classified.isCancelled) throw err;
      if (classified.isFatal) throw err;
      if (classified.isContextOverflow) throw err;
      if (!classified.isRetryable) throw err;
      if (attempt >= maxAttempts) {
        logger.error(
          `Max retry attempts (${maxAttempts}) exhausted: ${classified.message}`,
        );
        throw err;
      }

      const delayMs = computeDelay(attempt, err);
      options?.onRetry?.(attempt, classified, delayMs);

      logger.warn(
        `Retryable error on attempt ${attempt}/${maxAttempts}: ${classified.message}. Waiting ${delayMs}ms...`,
      );

      await sleep(delayMs, options?.signal);
    }
  }

  // TypeScript requires this — unreachable in practice
  throw new Error("Retry loop exhausted unexpectedly");
}

/**
 * Doom-loop detection: returns true if the last N tool calls are identical.
 * Same tool name + same serialized arguments = doom loop.
 */
export function isDoomLoop(
  recentCalls: Array<{ name: string; args: Record<string, unknown> }>,
  windowSize = 3,
): boolean {
  if (recentCalls.length < windowSize) return false;

  const last = recentCalls.slice(-windowSize);
  const first = last[0];
  if (!first) return false;

  const firstKey = `${first.name}::${JSON.stringify(first.args)}`;
  return last.every(
    (call) => `${call.name}::${JSON.stringify(call.args)}` === firstKey,
  );
}

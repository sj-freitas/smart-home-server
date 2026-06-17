import { sleep } from "./sleep";

export class RetryError extends Error {
  public failures: unknown[];
  public attempts: number;

  constructor(message: string, failures: unknown[], attempts: number) {
    super(message);
    this.name = "RetryError";
    this.failures = failures;
    this.attempts = attempts;
    // Restore prototype chain for instanceof checks (TS/ES target issues)
    Object.setPrototypeOf(this, RetryError.prototype);
  }
}

/**
 * Wrap an async function with retry logic.
 *
 * @param fn - function to wrap; must return a Promise<R>
 * @param retries - number of retries after the first attempt (default: 3)
 * @param intervalMs - base interval in milliseconds between attempts (default: 1000)
 * @param exponential - if true, apply exponential backoff (default: false)
 * @param onRetry - optional callback fired before each retry with 1-based attempt number, maxAttempts, and the error that caused the retry
 *
 * Returns a function with the same parameter list and return type as `fn`.
 */
export function withRetries<F extends (...args: any[]) => Promise<any>>(
  fn: F,
  retries = 3,
  intervalMs = 1000,
  exponential = false,
  onRetry?: (attempt: number, maxAttempts: number, error: unknown) => void,
): (...args: Parameters<F>) => ReturnType<F> {
  const wrapped = async (...args: Parameters<F>): Promise<any> => {
    const failures: unknown[] = [];
    const maxAttempts = retries + 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Attempt the underlying function
        return await fn(...args);
      } catch (err) {
        failures.push(err);

        // If this was the last attempt, break and throw below
        const isLastAttempt = attempt === maxAttempts - 1;
        if (isLastAttempt) {
          break;
        }

        onRetry?.(attempt + 1, maxAttempts, err);

        // Compute wait time
        const backoffMultiplier = exponential ? 2 ** attempt : 1;
        const waitMs = intervalMs * backoffMultiplier;

        // Wait before next attempt
        await sleep(waitMs);
      }
    }

    // All attempts failed
    throw new RetryError(
      `Operation failed after ${maxAttempts} attempt${maxAttempts === 1 ? "" : "s"}.`,
      failures,
      maxAttempts,
    );
  };

  // Cast to original function type to keep type compatibility for callers
  return wrapped as (...args: Parameters<F>) => ReturnType<F>;
}

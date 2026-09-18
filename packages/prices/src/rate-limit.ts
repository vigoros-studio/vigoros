/**
 * Token-bucket limiter. Vendors meter per hour and per day; this keeps us under both without
 * a scheduler. Awaiting `take()` resolves when a token is available.
 */
export class TokenBucket {
  private tokens: number
  private last = Date.now()

  constructor(
    private readonly capacity: number,
    private readonly refillPerMs: number,
  ) {
    this.tokens = capacity
  }

  static perHour(n: number): TokenBucket {
    return new TokenBucket(n, n / 3_600_000)
  }

  private refill(): void {
    const now = Date.now()
    this.tokens = Math.min(this.capacity, this.tokens + (now - this.last) * this.refillPerMs)
    this.last = now
  }

  async take(): Promise<void> {
    this.refill()
    if (this.tokens >= 1) {
      this.tokens -= 1
      return
    }
    const waitMs = Math.ceil((1 - this.tokens) / this.refillPerMs)
    await new Promise((r) => setTimeout(r, waitMs))
    this.refill()
    this.tokens -= 1
  }
}

/** Run tasks with bounded concurrency, preserving input order in the result. */
export const mapConcurrent = async <T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> => {
  const results: PromiseSettledResult<R>[] = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      try {
        results[i] = { status: 'fulfilled', value: await fn(items[i] as T, i) }
      } catch (reason) {
        results[i] = { status: 'rejected', reason }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return results
}

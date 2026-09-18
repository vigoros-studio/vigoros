import type { Db } from '@vigoros/db'
import type { IngestPlan } from '@vigoros/prices'
import type { ForecastProvider } from '@vigoros/reference'
import type { OtsClient } from '@vigoros/sealing'

export interface Logger {
  info(msg: string, data?: Record<string, unknown>): void
  warn(msg: string, data?: Record<string, unknown>): void
  error(msg: string, data?: Record<string, unknown>): void
}

export const consoleLogger: Logger = {
  info: (m, d) => console.log(JSON.stringify({ level: 'info', msg: m, ...d })),
  warn: (m, d) => console.warn(JSON.stringify({ level: 'warn', msg: m, ...d })),
  error: (m, d) => console.error(JSON.stringify({ level: 'error', msg: m, ...d })),
}

/** Reference-model config stored on participants.config. */
export interface ReferenceModelConfig {
  provider: 'anthropic' | 'openai' | 'deepseek'
  model: string
  promptVersion: string
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max'
}

export interface JobContext {
  db: Db
  log: Logger
  now: () => Date
  prices: IngestPlan
  ots: OtsClient
  /** Builds a provider from a participant's stored config. Returns null if the key is missing. */
  providerFor: (config: ReferenceModelConfig) => ForecastProvider | null
  /** Wall-clock budget for one invocation, so chunked jobs stop before the platform kills them. */
  timeBudgetMs: number
}

export class Deadline {
  private readonly end: number
  constructor(budgetMs: number, private readonly now: () => Date) {
    this.end = now().getTime() + budgetMs
  }
  get remainingMs(): number {
    return this.end - this.now().getTime()
  }
  get expired(): boolean {
    return this.remainingMs <= 0
  }
}

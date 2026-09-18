import 'server-only'
import { consoleLogger, type JobContext, type ReferenceModelConfig } from '@vigoros/jobs'
import { StooqSource, TiingoSource, type PriceSource } from '@vigoros/prices'
import { AnthropicProvider, OpenAICompatibleProvider, type ForecastProvider } from '@vigoros/reference'
import { OtsClient } from '@vigoros/sealing'
import { db } from './db'
import { env } from './env'

export const jobContext = (): JobContext => {
  const e = env()
  const tiingo = e.TIINGO_API_KEY ? new TiingoSource({ apiKey: e.TIINGO_API_KEY }) : null
  const stooq = new StooqSource()
  const withTiingo = (...rest: PriceSource[]): PriceSource[] => (tiingo ? [tiingo, ...rest] : rest)
  return {
    db: db(),
    log: consoleLogger,
    now: () => new Date(),
    timeBudgetMs: e.JOB_TIME_BUDGET_MS,
    ots: new OtsClient(),
    prices: {
      sourcesByVenue: {
        US: withTiingo(stooq),
        UK: [stooq],
        FX: withTiingo(stooq),
        CRYPTO: withTiingo(),
      },
      concurrency: 4,
    },
    providerFor: (config: ReferenceModelConfig): ForecastProvider | null => {
      switch (config.provider) {
        case 'anthropic':
          return e.ANTHROPIC_API_KEY
            ? new AnthropicProvider({ apiKey: e.ANTHROPIC_API_KEY, model: config.model, ...(config.effort ? { effort: config.effort } : {}) })
            : null
        case 'openai':
          return e.OPENAI_API_KEY ? new OpenAICompatibleProvider({ id: 'openai', model: config.model, apiKey: e.OPENAI_API_KEY, jsonMode: 'schema' }) : null
        case 'deepseek':
          return e.DEEPSEEK_API_KEY
            ? new OpenAICompatibleProvider({ id: 'deepseek', model: config.model, apiKey: e.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com', jsonMode: 'object' })
            : null
      }
    },
  }
}

export const todayUtc = (): string => new Date().toISOString().slice(0, 10)

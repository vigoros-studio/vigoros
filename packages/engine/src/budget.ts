import type { ModelId } from '@vigoros/contracts'

/** USD per million tokens. Anthropic first-party rates, cached 2026-10-06. */
export const MODEL_PRICES: Record<
  ModelId,
  { input: number; output: number; cacheRead: number; cacheWrite: number }
> = {
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
}

export interface Usage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

export const costOf = (usage: Usage, model: ModelId): number => {
  const p = MODEL_PRICES[model]
  const usd =
    (usage.inputTokens * p.input +
      usage.outputTokens * p.output +
      usage.cacheReadTokens * p.cacheRead +
      usage.cacheWriteTokens * p.cacheWrite) /
    1_000_000
  return Math.round(usd * 1_000_000) / 1_000_000
}

/** Four nested caps. A spend may proceed only if it fits inside every one of them. */
export interface CapCheck {
  level: 'run' | 'task' | 'department_day' | 'company_day'
  capUsd: number
  spentUsd: number
}

export type BudgetVerdict =
  | { ok: true }
  | { ok: false; level: CapCheck['level']; capUsd: number; spentUsd: number; estimateUsd: number }

export const checkBudget = (estimateUsd: number, caps: readonly CapCheck[]): BudgetVerdict => {
  for (const c of caps) {
    if (c.spentUsd + estimateUsd > c.capUsd) {
      return { ok: false, level: c.level, capUsd: c.capUsd, spentUsd: c.spentUsd, estimateUsd }
    }
  }
  return { ok: true }
}

/** Conservative pre-call estimate: assume the full output allowance is used. */
export const estimateTurnUsd = (
  model: ModelId,
  promptTokens: number,
  maxOutputTokens: number,
): number =>
  costOf(
    {
      inputTokens: promptTokens,
      outputTokens: maxOutputTokens,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    },
    model,
  )

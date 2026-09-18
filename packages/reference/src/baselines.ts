import { clipProbability, type Question } from '@vigoros/domain'
import { mulberry32 } from '@vigoros/scoring'

export type BaselineId = 'prior' | 'momentum' | 'mean_reversion' | 'random'

export interface BaselineContext {
  /** Trailing 63-trading-day return per asset id, at issue. */
  trailingReturn: ReadonlyMap<string, number>
  /** Published daily seed; the random baseline is reproducible from it. */
  seed: string
}

const hash32 = (s: string): number => {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * Baselines from methodology §9. Pure functions of the question and public context.
 * Momentum and mean reversion shade the prior by 0.05 in the direction of the trailing return,
 * applied only to questions whose YES is "the asset goes up or outperforms".
 */
export const baselineForecast = (id: BaselineId, q: Question, ctx: BaselineContext): { p: number; reasoning: string } => {
  switch (id) {
    case 'prior':
      return { p: q.prior, reasoning: 'Base rate for this question type.' }
    case 'momentum':
    case 'mean_reversion': {
      const r = ctx.trailingReturn.get(q.assetId)
      if (r === undefined) return { p: q.prior, reasoning: 'No trailing return available; base rate.' }
      const sign = (r > 0 ? 1 : -1) * (id === 'momentum' ? 1 : -1)
      return {
        p: clipProbability(q.prior + 0.05 * sign),
        reasoning: `${id === 'momentum' ? 'Momentum' : 'Mean reversion'}: trailing 63d return ${(r * 100).toFixed(1)}%.`,
      }
    }
    case 'random': {
      const rand = mulberry32(hash32(`${ctx.seed}|${q.id}`))
      return { p: 0.3 + 0.4 * rand(), reasoning: 'Uniform draw on [0.30, 0.70], seeded.' }
    }
  }
}

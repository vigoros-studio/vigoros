import { z } from 'zod'
import { IsoDateSchema, UlidSchema } from './ids'
import { HORIZONS } from './methodology'
import { VenueId } from './venues'

export const QuestionType = z.enum(['LEVEL', 'RELATIVE', 'QUINTILE'])
export type QuestionType = z.infer<typeof QuestionType>

/** For LEVEL questions: threshold = close × (1 + k·σ√h), k ∈ {-1, 0, 1}. */
export const LevelK = z.union([z.literal(-1), z.literal(0), z.literal(1)])
export type LevelK = z.infer<typeof LevelK>

export const QuestionStatus = z.enum(['OPEN', 'PENDING', 'RESOLVED', 'VOID'])
export type QuestionStatus = z.infer<typeof QuestionStatus>

export const QuestionSchema = z.object({
  id: UlidSchema,
  issueDate: IsoDateSchema,
  venue: VenueId,
  assetId: UlidSchema,
  symbol: z.string().min(1),
  type: QuestionType,
  horizon: z.union(HORIZONS.map((h) => z.literal(h)) as [z.ZodLiteral<5>, z.ZodLiteral<10>, z.ZodLiteral<21>]),
  /** Only for LEVEL. */
  levelK: LevelK.nullable(),
  /** Only for LEVEL: the price threshold, in the asset's quote currency. */
  threshold: z.number().positive().nullable(),
  /** Reference close at D-1 used to build the question. */
  referencePrice: z.number().positive(),
  /** The dumb prior q, fixed at issue. */
  prior: z.number().gt(0).lt(1),
  deadlineAt: z.string().datetime(),
  resolvesOn: IsoDateSchema,
  status: QuestionStatus,
  outcome: z.union([z.literal(0), z.literal(1)]).nullable(),
  resolvedAt: z.string().datetime().nullable(),
  methodologyVersion: z.string(),
})
export type Question = z.infer<typeof QuestionSchema>

/** Price formatting by magnitude: equities to 2dp, sub-unit FX to 5dp. Display only. */
export const formatPrice = (x: number): string => {
  const dp = x >= 100 ? 2 : x >= 1 ? 3 : 5
  return x.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp })
}

/** Human-readable statement of a question, used everywhere it is displayed. */
export const describeQuestion = (q: Pick<Question, 'symbol' | 'type' | 'horizon' | 'threshold' | 'resolvesOn'>): string => {
  switch (q.type) {
    case 'LEVEL':
      return `${q.symbol} closes above ${q.threshold === null ? '?' : formatPrice(q.threshold)} on ${q.resolvesOn}`
    case 'RELATIVE':
      return `${q.symbol} outperforms its peer group over the next ${q.horizon} trading days`
    case 'QUINTILE':
      return `${q.symbol} finishes in the top quintile of its universe over the next ${q.horizon} trading days`
  }
}

import { ulid, decodeTime } from 'ulid'
import { z } from 'zod'

/** ULIDs everywhere: time-sortable, index-friendly, no coordination. */
export const UlidSchema = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, 'invalid ulid')
export type Ulid = z.infer<typeof UlidSchema>

export const newId = (at?: Date): Ulid => ulid(at?.getTime())
export const idTime = (id: Ulid): Date => new Date(decodeTime(id))

/** ISO calendar date, YYYY-MM-DD, always UTC-interpreted. */
export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'invalid iso date')
export type IsoDate = z.infer<typeof IsoDateSchema>

export const toIsoDate = (d: Date): IsoDate => d.toISOString().slice(0, 10)

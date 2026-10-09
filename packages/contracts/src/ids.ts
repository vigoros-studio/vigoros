import { ulid } from 'ulid'
import { z } from 'zod'

/** Every row id is a typed ULID: `tsk_01J...`. The prefix makes ids self-describing in logs. */
export const ID_PREFIXES = {
  company: 'cmp',
  character: 'chr',
  department: 'dep',
  agent: 'agt',
  task: 'tsk',
  run: 'run',
  message: 'msg',
  meeting: 'mtg',
  decision: 'dec',
  approval: 'apr',
  artifact: 'art',
  budget: 'bgt',
  cost: 'cst',
  event: 'evt',
  note: 'nte',
  workflow: 'wfl',
} as const

export type IdKind = keyof typeof ID_PREFIXES
export type Id<K extends IdKind> = `${(typeof ID_PREFIXES)[K]}_${string}`

export const newId = <K extends IdKind>(kind: K): Id<K> => `${ID_PREFIXES[kind]}_${ulid()}` as Id<K>

export const idSchema = <K extends IdKind>(kind: K) =>
  z
    .string()
    .regex(new RegExp(`^${ID_PREFIXES[kind]}_[0-9A-HJKMNP-TV-Z]{26}$`))
    .transform((s) => s as Id<K>)

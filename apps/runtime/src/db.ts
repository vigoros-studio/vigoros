import { createDb, type Db } from '@vigoros/db'
import { env } from './env'

let cached: Db | null = null
export const db = (): Db => (cached ??= createDb(env().DATABASE_URL))

import { Event, newId } from '@vigoros/contracts'
import type { z } from 'zod'
import { events, type Db } from '@vigoros/db'

/** The only write path to the event log. The HQ scene reads nothing else. */
export const emit = async (db: Db, e: z.input<typeof Event>): Promise<void> => {
  const row = Event.parse(e)
  await db.insert(events).values({ id: newId('event'), ...row })
}

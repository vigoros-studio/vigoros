import { Event, newId } from '@vigoros/contracts'
import { events } from '@vigoros/db'
import { db } from './db'

/** The only write path to the event log. The HQ scene reads nothing else. */
export const emit = async (e: Event): Promise<void> => {
  const row = Event.parse(e)
  await db()
    .insert(events)
    .values({ id: newId('event'), ...row })
}

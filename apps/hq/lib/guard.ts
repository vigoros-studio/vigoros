import 'server-only'
import { NextResponse } from 'next/server'
import { founder } from './session'

/** Every API route is founder-only. */
export const requireFounder = async () => {
  const me = await founder()
  if (!me) return { me: null, deny: NextResponse.json({ error: 'unauthorised' }, { status: 401 }) }
  return { me, deny: null }
}

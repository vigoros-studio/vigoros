import { redirect } from 'next/navigation'
import { HqClient } from '@/components/hq/HqClient'
import { env } from '@/lib/env'
import { founder } from '@/lib/session'

export const dynamic = 'force-dynamic'

/** The front door: the 3D headquarters. Private; the 2D views live under /ops. */
export default async function Page() {
  const me = await founder()
  if (!me) redirect('/login')
  const e = env()
  return (
    <HqClient
      supabaseUrl={e.NEXT_PUBLIC_SUPABASE_URL ?? ''}
      anonKey={e.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''}
      adapterMode={process.env['MODEL_ADAPTER'] ?? 'fake'}
    />
  )
}

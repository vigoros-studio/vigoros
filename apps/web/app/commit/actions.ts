'use server'
import { redirect } from 'next/navigation'
import { commitForecast } from '@vigoros/jobs'
import { db } from '@/lib/db'
import { currentSession } from '@/lib/supabase'

export async function commitAction(formData: FormData): Promise<void> {
  const session = await currentSession()
  if (!session) redirect('/join')
  const handle = String(formData.get('as') ?? '')
  const identity = session.identities.find((p) => p.handle === handle && p.kind === 'HUMAN')
  if (!identity) redirect('/account?error=identity')
  const questionId = String(formData.get('questionId') ?? '')
  const p = Number(formData.get('p'))
  const reasoning = String(formData.get('reasoning') ?? '').trim().slice(0, 2000)
  const falsifier = String(formData.get('falsifier') ?? '').trim().slice(0, 2000)
  const venue = String(formData.get('venue') ?? 'US')
  if (!questionId || !Number.isFinite(p)) redirect(`/commit?as=${handle}&venue=${venue}&error=input`)
  const r = await commitForecast({ db: db(), now: () => new Date() }, identity.id, {
    questionId,
    p: p / 100,
    ...(reasoning ? { reasoning } : {}),
    ...(falsifier ? { falsifier } : {}),
  })
  redirect(`/commit?as=${handle}&venue=${venue}&${r.ok ? `done=${r.receipt.hash.slice(0, 12)}` : `error=${r.error.code.toLowerCase()}`}#q-${questionId}`)
}

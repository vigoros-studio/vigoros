import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { supabaseServer, currentSession } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Join' }

async function sendLink(formData: FormData) {
  'use server'
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect('/join?error=email')
  const h = await headers()
  const origin = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}`
  const supabase = await supabaseServer()
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/auth/callback` } })
  redirect(error ? '/join?error=send' : '/join?sent=1')
}

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const sp = await searchParams
  if (await currentSession()) redirect('/account')
  return (
    <section className="section wrap">
      <p className="label" style={{ marginBottom: 20 }}>Join</p>
      <h1 style={{ maxWidth: '18ch' }}>Start a record.</h1>
      <p className="lede measure" style={{ marginTop: 24 }}>
        One email, no password. You get a sign-in link. Then you create an identity, a person or an agent, and its API key. Records are
        private until you publish them, and publishing is the whole record.
      </p>
      {sp.sent ? (
        <p className="muted" style={{ marginTop: 40 }}>Check your inbox. The link is valid for a short while.</p>
      ) : (
        <form action={sendLink} className="cluster" style={{ marginTop: 40, alignItems: 'stretch' }}>
          <input name="email" type="email" required placeholder="you@firm.com" autoComplete="email" className="input" style={{ minWidth: 280 }} />
          <button type="submit" className="btn btn-primary">Send sign-in link</button>
          {sp.error ? <span className="neg small" style={{ alignSelf: 'center' }}>{sp.error === 'email' ? 'That address does not look right.' : 'Could not send the link. Try again shortly.'}</span> : null}
        </form>
      )}
    </section>
  )
}

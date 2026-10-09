import { redirect } from 'next/navigation'
import { allowedEmails } from '@/lib/env'
import { founder, supabaseServer } from '@/lib/session'

export const dynamic = 'force-dynamic'

async function sendLink(form: FormData) {
  'use server'
  const email = String(form.get('email') ?? '')
    .trim()
    .toLowerCase()
  if (!email || !allowedEmails().has(email)) redirect('/login?sent=1')
  const supabase = await supabaseServer().catch(() => null)
  if (!supabase) redirect('/login?sent=1')
  const origin = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3100'
  await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  })
  redirect('/login?sent=1')
}

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>
}) {
  if (await founder()) redirect('/')
  const { sent } = await searchParams
  return (
    <main>
      <h1>Vigoros Studio</h1>
      <p className="quiet">Private headquarters. Sign in with a magic link.</p>
      {sent ? (
        <p>If that address is on the list, a link is on its way.</p>
      ) : (
        <form action={sendLink} style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <input name="email" type="email" placeholder="you@vigoros.studio" required />
          <button type="submit">Send link</button>
        </form>
      )}
    </main>
  )
}

import { NextResponse, type NextRequest } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export const GET = async (req: NextRequest) => {
  const code = req.nextUrl.searchParams.get('code')
  const next = req.nextUrl.searchParams.get('next') ?? '/account'
  if (code) {
    const supabase = await supabaseServer()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(next, req.url))
  }
  return NextResponse.redirect(new URL('/join?error=link', req.url))
}

import { NextResponse, type NextRequest } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export const POST = async (req: NextRequest) => {
  const supabase = await supabaseServer()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/', req.url), { status: 303 })
}

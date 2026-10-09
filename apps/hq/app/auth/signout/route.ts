import { NextResponse, type NextRequest } from 'next/server'
import { supabaseServer } from '@/lib/session'

export async function GET(request: NextRequest) {
  const supabase = await supabaseServer()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/login', request.url))
}

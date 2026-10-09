'use client'
import { createBrowserClient } from '@supabase/ssr'
import { useEffect } from 'react'
import { useHq } from './store'

/**
 * Persisted state first, live updates second. The snapshot is always the truth; a Realtime insert
 * on studio.events only tells us to fetch it again. Reconnects and tab focus refetch; if Realtime
 * is unavailable we poll, and the header says so.
 */
export const useLiveSnapshot = (supabaseUrl: string, anonKey: string) => {
  const refresh = useHq((s) => s.refresh)
  const setConnection = useHq((s) => s.setConnection)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const bump = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => void refresh(), 150)
    }
    void refresh()

    // No anon key: no Realtime. The header says "polling" so nobody mistakes it for live.
    const supabase = supabaseUrl && anonKey ? createBrowserClient(supabaseUrl, anonKey) : null
    if (!supabase) setConnection('polling')
    const channel = supabase
      ?.channel('studio-events')
      .on('postgres_changes', { event: 'INSERT', schema: 'studio', table: 'events' }, bump)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnection('live')
          bump()
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setConnection('polling')
        }
      })

    const poll = setInterval(() => {
      const c = useHq.getState().connection
      if (c !== 'live') void refresh()
    }, 10_000)
    const keepalive = setInterval(() => void refresh(), 60_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') bump()
    }
    const onOnline = () => {
      setConnection('connecting')
      bump()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    window.addEventListener('focus', onVisible)

    return () => {
      if (timer) clearTimeout(timer)
      clearInterval(poll)
      clearInterval(keepalive)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('focus', onVisible)
      if (supabase && channel) void supabase.removeChannel(channel)
    }
  }, [supabaseUrl, anonKey, refresh, setConnection])
}

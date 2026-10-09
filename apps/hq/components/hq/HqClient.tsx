'use client'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { useLiveSnapshot } from '@/lib/realtime'
import { useHq } from '@/lib/store'
import { Panels } from './Panels'

const Scene = dynamic(() => import('./Scene').then((m) => m.Scene), {
  ssr: false,
  loading: () => <div className="hq-loading">Lighting the building…</div>,
})

export function HqClient({
  supabaseUrl,
  anonKey,
  adapterMode,
}: {
  supabaseUrl: string
  anonKey: string
  adapterMode: string
}) {
  useLiveSnapshot(supabaseUrl, anonKey)
  const [noScene, setNoScene] = useState(false)
  useEffect(() => {
    setNoScene(new URLSearchParams(window.location.search).has('noscene'))
    // Development only: lets a capture script drive selection without clicking into the canvas.
    if (process.env.NODE_ENV !== 'production')
      (window as unknown as { __hq: typeof useHq }).__hq = useHq
  }, [])
  return (
    <div className="hq">
      {!noScene && <Scene />}
      <Panels adapterMode={adapterMode} />
    </div>
  )
}

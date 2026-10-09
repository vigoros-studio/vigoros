'use client'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { useLiveSnapshot } from '@/lib/realtime'
import { useHq } from '@/lib/store'
import { Panels } from './Panels'

const Scene = dynamic(() => import('./v2/SceneV2').then((m) => m.SceneV2), {
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
    // Keyboard: Escape steps back one framing (employee to room to overview), Home returns to the overview.
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const { selection, select, snapshot, goHome } = useHq.getState()
      if (e.key === 'Home') goHome()
      if (e.key === 'Escape') {
        if (selection?.kind === 'agent') {
          const a = snapshot?.agents.find((x) => x.id === selection.id)
          select(a ? { kind: 'department', id: a.departmentId } : null)
        } else select(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <div className="hq">
      {!noScene && <Scene />}
      <Panels adapterMode={adapterMode} />
    </div>
  )
}

'use client'
import type { Snapshot } from '@vigoros/ops'
import { create } from 'zustand'

export type Selection =
  | { kind: 'agent'; id: string }
  | { kind: 'department'; id: string }
  | { kind: 'boardroom' }
  | { kind: 'workflow'; id: string }
  | null

export interface HqState {
  snapshot: Snapshot | null
  selection: Selection
  focus: { x: number; z: number; zoom: number } | null
  connection: 'connecting' | 'live' | 'polling' | 'offline'
  lastEventAt: string | null
  /** Bumped by Home so the camera returns to the overview even when nothing was selected. */
  homeTick: number
  goHome: () => void
  select: (s: Selection) => void
  setFocus: (f: HqState['focus']) => void
  setSnapshot: (s: Snapshot) => void
  setConnection: (c: HqState['connection']) => void
  refresh: () => Promise<void>
}

let inflight: Promise<void> | null = null

/** One store for the scene and the panels, fed by /api/snapshot. Events only trigger a refresh. */
export const useHq = create<HqState>((set, get) => ({
  snapshot: null,
  selection: null,
  focus: null,
  connection: 'connecting',
  lastEventAt: null,
  homeTick: 0,
  goHome: () => set((s) => ({ selection: null, homeTick: s.homeTick + 1 })),
  select: (selection) => set({ selection }),
  setFocus: (focus) => set({ focus }),
  setSnapshot: (snapshot) => set({ snapshot }),
  setConnection: (connection) => set({ connection }),
  refresh: async () => {
    if (inflight) return inflight
    inflight = (async () => {
      try {
        const res = await fetch('/api/snapshot', { cache: 'no-store' })
        if (res.status === 401) {
          window.location.href = '/login'
          return
        }
        const s = (await res.json()) as Snapshot | { error: string }
        if ('company' in s) set({ snapshot: s, lastEventAt: new Date().toISOString() })
      } catch {
        if (get().connection !== 'offline') set({ connection: 'offline' })
      } finally {
        inflight = null
      }
    })()
    return inflight
  },
}))

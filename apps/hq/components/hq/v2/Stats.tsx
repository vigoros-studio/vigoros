'use client'
import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'

/**
 * Renderer counters for `?stats=1`, written into the overlay element every half second: draw
 * calls, triangles, programs, resolution, and a rolling frame-time histogram. After ten seconds it
 * prints the benchmark line (median fps, 1 % low, longest frame) so the numbers can be read off
 * the running app on the machine that matters, with no capture tooling in the way.
 */
export function Stats({ label }: { label: string }) {
  const gl = useThree((s) => s.gl)
  const frames = useRef<number[]>([])
  const all = useRef<number[]>([])
  const last = useRef(0)
  const start = useRef(0)
  const bench = useRef('')
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (start.current === 0) start.current = t
    if (last.current) {
      const dt = (t - last.current) * 1000
      frames.current.push(dt)
      if (t - start.current > 2) all.current.push(dt)
    }
    last.current = t
    if (frames.current.length < 30) return
    const sorted = [...frames.current].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0
    const worst = sorted[sorted.length - 1] ?? 0
    frames.current = []
    if (!bench.current && t - start.current > 12 && all.current.length > 60) {
      const s = [...all.current].sort((a, b) => a - b)
      const med = s[Math.floor(s.length / 2)] ?? 0
      const low1 = s[Math.floor(s.length * 0.99)] ?? 0
      const over33 = all.current.filter((f) => f > 33.4).length
      bench.current = `bench (10 s): median ${(1000 / med).toFixed(1)} fps · 1% low ${(1000 / low1).toFixed(1)} fps · longest ${(s[s.length - 1] ?? 0).toFixed(0)} ms · frames over 33 ms: ${over33}/${all.current.length}`
    }
    const el = document.getElementById('hq-stats')
    if (!el) return
    const i = gl.info
    el.textContent = [
      `${label}`,
      `draw calls ${i.render.calls} · triangles ${i.render.triangles.toLocaleString()} · programs ${i.programs?.length ?? 0}`,
      `canvas ${gl.domElement.width}×${gl.domElement.height} @ dpr ${gl.getPixelRatio().toFixed(2)} · geometries ${i.memory.geometries} · textures ${i.memory.textures}`,
      `now: ${(1000 / median).toFixed(1)} fps median · longest frame ${worst.toFixed(0)} ms`,
      bench.current ||
        `benchmark collecting… (${Math.max(0, 12 - Math.floor(t - start.current))} s)`,
    ].join('\n')
  })
  return null
}

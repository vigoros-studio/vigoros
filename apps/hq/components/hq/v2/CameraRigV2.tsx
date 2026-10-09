'use client'
import { CameraControls, PerspectiveCamera } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import type { RoomGeom } from '@/lib/layout'
import { useHq } from '@/lib/store'

export type Framing =
  | { kind: 'overview'; target: THREE.Vector3 }
  | { kind: 'room'; target: THREE.Vector3; azimuth: number }
  | { kind: 'employee'; target: THREE.Vector3; azimuth: number }

const SPEC = {
  overview: {
    distance: 38,
    elevation: THREE.MathUtils.degToRad(38),
    fov: 28,
    polar: [THREE.MathUtils.degToRad(35), THREE.MathUtils.degToRad(65)] as const,
    azimuthRange: THREE.MathUtils.degToRad(35),
  },
  room: {
    distance: 13,
    elevation: THREE.MathUtils.degToRad(30),
    fov: 34,
    polar: [THREE.MathUtils.degToRad(40), THREE.MathUtils.degToRad(72)] as const,
    azimuthRange: THREE.MathUtils.degToRad(60),
  },
  employee: {
    distance: 3.6,
    elevation: THREE.MathUtils.degToRad(18),
    fov: 40,
    polar: [THREE.MathUtils.degToRad(50), THREE.MathUtils.degToRad(82)] as const,
    azimuthRange: THREE.MathUtils.degToRad(90),
  },
}

/**
 * Three composed framings on one damped perspective camera. Free orbit, zoom and pan are allowed
 * within limits in every framing; a new selection bends the current move rather than jumping.
 */
export function CameraRigV2({
  framing,
  bounds,
}: {
  framing: Framing
  bounds: { cx: number; cz: number; w: number; d: number }
}) {
  const controls = useRef<CameraControls | null>(null)
  // The controls instance is recreated when the default camera changes; framing must re-apply to the new one.
  const [ready, setReady] = useState<CameraControls | null>(null)
  const { camera } = useThree()
  const last = useRef<string>('')
  const attach = useCallback(
    (c: CameraControls | null) => {
      controls.current = c
      if (c !== ready) last.current = ''
      setReady(c)
      if (c) {
        // The target may roam inside the building and a little beyond; never below the floor.
        c.setBoundary(
          new THREE.Box3(
            new THREE.Vector3(bounds.cx - bounds.w / 2 - 2, 0.2, bounds.cz - bounds.d / 2 - 2),
            new THREE.Vector3(bounds.cx + bounds.w / 2 + 2, 3, bounds.cz + bounds.d / 2 + 2),
          ),
        )
      }
    },
    [bounds.cx, bounds.cz, bounds.w, bounds.d, ready],
  )

  useEffect(() => {
    const c = controls.current
    if (!c) return
    const base = SPEC[framing.kind]
    // The overview distance follows the building so the whole floor plan always fits.
    // Fit the whole floor plan: nearer on wide windows, further on narrow ones.
    const aspect =
      typeof window === 'undefined' ? 1.6 : window.innerWidth / Math.max(1, window.innerHeight)
    const fit = THREE.MathUtils.clamp(1.6 / aspect, 0.9, 1.25)
    const spec =
      framing.kind === 'overview'
        ? { ...base, distance: Math.max(bounds.w, bounds.d) * 1.32 * fit }
        : base
    const az = framing.kind === 'overview' ? THREE.MathUtils.degToRad(45) : framing.azimuth
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __cam: unknown }).__cam = c
    const t = framing.target
    const px = t.x + Math.sin(az) * Math.cos(spec.elevation) * spec.distance
    const pz = t.z + Math.cos(az) * Math.cos(spec.elevation) * spec.distance
    const py = t.y + Math.sin(spec.elevation) * spec.distance
    const key = `${framing.kind}:${t.x.toFixed(1)},${t.z.toFixed(1)}`
    if (key === last.current) return
    const first = last.current === ''
    last.current = key
    c.minPolarAngle = spec.polar[0]
    c.maxPolarAngle = spec.polar[1]
    c.minAzimuthAngle = az - spec.azimuthRange
    c.maxAzimuthAngle = az + spec.azimuthRange
    c.minDistance = spec.distance * 0.45
    c.maxDistance = spec.distance * 1.8
    void c.setLookAt(px, py, pz, t.x, t.y, t.z, !first)
    const cam = camera as THREE.PerspectiveCamera
    const fovFrom = cam.fov
    const start = performance.now()
    const tick = () => {
      const k = Math.min(1, (performance.now() - start) / 900)
      const e = 1 - Math.pow(1 - k, 3)
      cam.fov = fovFrom + (spec.fov - fovFrom) * e
      cam.updateProjectionMatrix()
      if (k < 1) requestAnimationFrame(tick)
    }
    tick()
  }, [framing, camera, bounds.w, bounds.d, ready])

  return (
    <>
      <PerspectiveCamera
        makeDefault
        fov={28}
        near={0.1}
        far={300}
        position={[bounds.cx + 26, 24, bounds.cz + 26]}
      />
      <CameraControls
        ref={attach}
        smoothTime={0.45}
        draggingSmoothTime={0.12}
        dollySpeed={0.6}
        truckSpeed={1.2}
        onStart={() => useHq.getState().setFocus(null)}
      />
    </>
  )
}

/** Which framing the current selection implies. */
export const framingFor = (
  selection: ReturnType<typeof useHq.getState>['selection'],
  rooms: RoomGeom[],
  bounds: { cx: number; cz: number },
  agentPos: (id: string) => { x: number; z: number; facing: number; roomId: string } | null,
): Framing => {
  if (selection?.kind === 'department') {
    const r = rooms.find((x) => x.id === selection.id)
    if (r)
      return {
        kind: 'room',
        target: new THREE.Vector3(r.cx, 0.9, r.cz),
        azimuth: THREE.MathUtils.degToRad(45),
      }
  }
  if (selection?.kind === 'boardroom') {
    const r = rooms.find((x) => x.key === 'executive')
    if (r)
      return {
        kind: 'room',
        target: new THREE.Vector3(r.x + r.w * 0.75, 0.9, r.cz),
        azimuth: THREE.MathUtils.degToRad(45),
      }
  }
  if (selection?.kind === 'agent') {
    const p = agentPos(selection.id)
    // The person faces world direction -facing (their group is turned around at the desk); the camera sits on that side, 40 degrees off axis.
    if (p)
      return {
        kind: 'employee',
        target: new THREE.Vector3(p.x, 1.05, p.z),
        azimuth: -p.facing + THREE.MathUtils.degToRad(40),
      }
  }
  return { kind: 'overview', target: new THREE.Vector3(bounds.cx, 0.6, bounds.cz) }
}

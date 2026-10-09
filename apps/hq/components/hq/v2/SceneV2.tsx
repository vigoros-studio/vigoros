'use client'
import { ContactShadows, Environment, Lightformer, PerformanceMonitor } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Bloom, EffectComposer, N8AO, SMAA, Vignette } from '@react-three/postprocessing'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { flag } from '@/lib/flags'
import { buildingBounds, deskPosition, roomGeom, seatAround, boardroomPosition } from '@/lib/layout'
import { useHq } from '@/lib/store'
import { Avatar } from '../Avatar'
import { Blockout } from './Blockout'
import { BuildingV2 } from './BuildingV2'
import { CameraRigV2, framingFor } from './CameraRigV2'
import { WritersRoom, writerStation } from './WritersRoom'

/**
 * The headquarters, second art pass. The shell, lighting and camera are new for every room; the
 * Writers' Room is the finished vertical slice; the other rooms keep block-out desks and capsule
 * avatars until the slice is approved. Everything placed here is derived from the snapshot.
 */
export function SceneV2() {
  const snapshot = useHq((s) => s.snapshot)
  const selection = useHq((s) => s.selection)
  const select = useHq((s) => s.select)
  const rooms = useMemo(() => (snapshot?.departments ?? []).map(roomGeom), [snapshot?.departments])
  const bounds = useMemo(
    () =>
      rooms.length
        ? buildingBounds(rooms)
        : { cx: 17, cz: 7, w: 36, d: 16, minX: 0, minZ: 0, maxX: 34, maxZ: 14 },
    [rooms],
  )
  const writersRoom = rooms.find((r) => r.key === 'creative')
  const exec = rooms.find((r) => r.key === 'executive')
  const table = exec ? boardroomPosition(exec) : null
  const meeting = (snapshot?.agents ?? []).filter((a) => a.state === 'meeting')
  const downAt = useRef<{ x: number; y: number } | null>(null)
  const capture = flag('capture')
  const fx = !flag('nofx')
  // Performance tiers: the monitor steps down (resolution first, then ambient occlusion) when the frame rate falls.
  const [tier, setTier] = useState<2 | 1 | 0>(2)
  const dpr: [number, number] = flag('dpr1') ? [1, 1] : tier === 2 ? [1, 1.25] : [1, 1]

  const agentPos = (id: string) => {
    const a = snapshot?.agents.find((x) => x.id === id)
    const room = a ? rooms.find((r) => r.id === a.departmentId) : undefined
    if (!a || !room) return null
    if (
      room.key === 'creative' &&
      (a.roleKey === 'comedy-writer-a' || a.roleKey === 'comedy-writer-b')
    ) {
      const s = writerStation(room, a.roleKey)
      return {
        x: s.x,
        z: s.z + 0.78 * (a.roleKey === 'comedy-writer-a' ? 0 : 0),
        facing: s.facing,
        roomId: room.id,
      }
    }
    const d = deskPosition(room, a.desk)
    return { x: d.x, z: d.z + 0.6, facing: 0, roomId: room.id }
  }
  const framing = useMemo(
    () => framingFor(selection, rooms, bounds, agentPos),
    [selection, rooms, bounds, snapshot?.agents],
  )
  if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production')
    (window as unknown as { __framing: unknown }).__framing = framing

  const brief =
    snapshot?.workflows.find(
      (w) => w.status !== 'done' && w.status !== 'rejected' && w.status !== 'failed',
    ) ?? snapshot?.workflows[0]
  const briefTitle = brief ? brief.title : 'Writers’ room'
  const briefLines = brief
    ? [
        `Workflow ${brief.status}, step ${brief.step}${brief.simulated ? ' (simulated)' : ''}`,
        '',
        'Rules of the room:',
        '1. The situation is normal; her reaction is too serious.',
        '2. Short lines. Silence is a joke.',
        '3. One idea per episode, hook in the first second.',
        '4. Stay inside the bible.',
      ]
    : [
        'No workflow running.',
        '',
        'Rules of the room:',
        '1. The situation is normal; her reaction is too serious.',
        '2. Short lines. Silence is a joke.',
        '3. One idea per episode, hook in the first second.',
      ]

  const blockout = rooms.filter((r) => r.key !== 'creative')
  const deskCount = new Map<string, number>()
  for (const r of rooms)
    deskCount.set(
      r.id,
      Math.max(
        2,
        snapshot?.agents.filter((a) => a.departmentId === r.id).length ?? 0,
        Math.min(6, r.d),
      ),
    )

  return (
    <Canvas
      shadows={{ type: THREE.PCFSoftShadowMap }}
      dpr={dpr}
      gl={{
        antialias: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: capture,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.18,
      }}
      onPointerMissed={(e) => {
        const d = downAt.current
        if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return
        select(null)
      }}
      onPointerDown={(e) => {
        downAt.current = { x: e.clientX, y: e.clientY }
      }}
      onCreated={({ gl }) => {
        // Development only: lets a profiling script read draw calls, triangles and programs.
        if (process.env.NODE_ENV !== 'production')
          (window as unknown as { __gl: unknown }).__gl = gl
      }}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at 50% 35%, #182038 0%, #0b0e18 65%)',
      }}
    >
      <color attach="background" args={['#0b0e18']} />
      <fog attach="fog" args={['#0b0e18', 55, 140]} />
      <PerformanceMonitor
        onDecline={() => setTier((t) => (t > 0 ? ((t - 1) as 2 | 1 | 0) : t))}
        onIncline={() => setTier((t) => (t < 2 ? ((t + 1) as 2 | 1 | 0) : t))}
        flipflops={3}
        onFallback={() => setTier(0)}
      />
      <CameraRigV2 framing={framing} bounds={bounds} />
      {/* environment: a cool sky dome and a warm strip above the studio, no network */}
      <Environment resolution={256} frames={1}>
        <Lightformer
          form="rect"
          intensity={1.2}
          color="#3b4a7a"
          scale={[60, 30, 1]}
          position={[0, 20, -40]}
        />
        <Lightformer
          form="rect"
          intensity={0.6}
          color="#2b3250"
          scale={[60, 30, 1]}
          position={[-40, 10, 0]}
          rotation={[0, Math.PI / 2, 0]}
        />
        <Lightformer
          form="ring"
          intensity={2.2}
          color="#ffd2a0"
          scale={10}
          position={[10, 14, 10]}
        />
        <Lightformer
          form="rect"
          intensity={0.4}
          color="#1a1f33"
          scale={[80, 80, 1]}
          position={[0, -10, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      </Environment>
      <hemisphereLight args={['#5a6a9a', '#1a1816', 0.55]} />
      <directionalLight
        position={[bounds.cx - 18, 26, bounds.cz - 10]}
        intensity={1.35}
        color="#c9d4ff"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.00025}
        shadow-normalBias={0.02}
        shadow-radius={4}
      >
        <orthographicCamera attach="shadow-camera" args={[-28, 28, 22, -22, 1, 90]} />
      </directionalLight>
      {rooms.length > 0 && (
        <BuildingV2 rooms={rooms}>
          {writersRoom && (
            <WritersRoom
              room={writersRoom}
              agents={snapshot?.agents ?? []}
              briefTitle={briefTitle}
              briefLines={briefLines}
            />
          )}
          {/* block-out rooms: desks and capsules as before, inside the new shell */}
          {!flag('noblockout') && blockout.length > 0 && (
            <Blockout rooms={blockout} deskCount={deskCount} />
          )}
        </BuildingV2>
      )}
      {snapshot?.agents.map((a) => {
        const room = rooms.find((r) => r.id === a.departmentId)
        if (!room || room.key === 'creative') return null
        const home = deskPosition(room, a.desk)
        const seatIndex = meeting.findIndex((m) => m.id === a.id)
        const seat = table && seatIndex >= 0 ? seatAround(table, seatIndex, meeting.length) : null
        return (
          <Avatar
            key={a.id}
            agent={a}
            departmentKey={room.key}
            home={{ x: home.x, z: home.z }}
            seat={seat}
          />
        )
      })}
      {/* writers' meeting seats: the writers walk to the boardroom when their row says meeting */}
      <ContactShadows
        position={[bounds.cx, 0.01, bounds.cz]}
        scale={60}
        blur={2.2}
        opacity={0.45}
        far={3}
        resolution={512}
        frames={1}
      />
      {fx && (
        <EffectComposer enableNormalPass={false} multisampling={0}>
          {tier > 0 ? (
            <N8AO aoRadius={1.2} intensity={1.6} distanceFalloff={0.6} quality="low" halfRes />
          ) : (
            <></>
          )}
          <Bloom luminanceThreshold={1.0} luminanceSmoothing={0.15} intensity={0.3} mipmapBlur />
          <SMAA />
          <Vignette eskil={false} offset={0.25} darkness={0.55} />
        </EffectComposer>
      )}
    </Canvas>
  )
}

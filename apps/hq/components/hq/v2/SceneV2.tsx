'use client'
import { ContactShadows, Environment, Lightformer, PerformanceMonitor } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Bloom, EffectComposer, N8AO, SMAA, Vignette } from '@react-three/postprocessing'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { flag } from '@/lib/flags'
import { buildingBounds, roomGeom } from '@/lib/layout'
import { useHq } from '@/lib/store'
import { BuildingV2 } from './BuildingV2'
import { CameraRigV2, framingFor } from './CameraRigV2'
import { Stats } from './Stats'
import { Studio, stationFor } from './Studio'

/** What hangs on each room's wall board. Brand assets, never stock people. */
const WALLS: Record<string, { images: string[]; label: string }> = {
  content: {
    images: [
      '/brand/signals-field.jpg',
      '/brand/scores-field.jpg',
      '/brand/monitor-field.jpg',
      '/brand/intelligence-field.jpg',
      '/brand/reference-field.jpg',
      '/brand/share-card.jpg',
    ],
    label: 'ONEGOODAREA · PRODUCT WORLDS',
  },
  executive: {
    images: [
      '/brand/home-hero.jpg',
      '/brand/proptech-hero.jpg',
      '/brand/signals-motion.jpg',
      '/brand/monitor-motion.jpg',
      '/brand/intelligence-motion.jpg',
      '/brand/scores-motion.jpg',
    ],
    label: 'THE INTELLIGENCE LAYER FOR PLACE',
  },
}

const RULES = [
  'Rules of the room:',
  '1. Every figure traces to a signal row.',
  '2. Withheld with the reason beats invented.',
  '3. Never lead with AI. No banned words.',
  '4. Great Britain. Four products, named exactly.',
]

/**
 * The headquarters. The shell, lighting and camera are shared; every room is a finished studio
 * with a workstation per agent. Everything placed here is derived from the snapshot.
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
        : { cx: 10, cz: 3.5, w: 24, d: 9, minX: 0, minZ: 0, maxX: 21, maxZ: 7 },
    [rooms],
  )
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
    const members = (snapshot?.agents ?? []).filter((x) => x.departmentId === room.id)
    const s = stationFor(
      room,
      Math.max(
        0,
        members.findIndex((x) => x.id === a.id),
      ),
      members.length,
    )
    return { x: s.x, z: s.z, facing: s.facing, roomId: room.id }
  }
  const framing = useMemo(
    () => framingFor(selection, rooms, bounds, agentPos),
    [selection, rooms, bounds, snapshot?.agents],
  )
  if (typeof window !== 'undefined' && process.env['NEXT_PUBLIC_HQ_DEBUG'] === '1')
    (window as unknown as { __framing: unknown }).__framing = framing

  const live =
    snapshot?.workflows.find(
      (w) => w.status !== 'done' && w.status !== 'rejected' && w.status !== 'failed',
    ) ?? snapshot?.workflows[0]
  const contentTitle = live ? live.title : 'Content studio'
  const contentLines = live
    ? [
        `Workflow ${live.status}, step ${live.step}${live.simulated ? ' (simulated)' : ''}`,
        '',
        ...RULES,
      ]
    : ['No workflow running.', '', ...RULES]
  const pending = snapshot?.pendingApprovals.length ?? 0
  const execTitle = 'This week'
  const execLines = [
    `${pending} decision${pending === 1 ? '' : 's'} awaiting the founder`,
    ...(snapshot?.workflows
      .slice(0, 4)
      .map((w) => `${w.status === 'done' ? '✓' : '·'} ${w.title} (${w.step})`) ?? []),
    '',
    'Measures: Density · Reach · Speed',
  ]

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
        if (process.env['NEXT_PUBLIC_HQ_DEBUG'] === '1')
          (window as unknown as { __gl: unknown }).__gl = gl
      }}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at 50% 35%, #1c2127 0%, #0e0f11 65%)',
      }}
    >
      <color attach="background" args={['#0e0f11']} />
      <fog attach="fog" args={['#0e0f11', 55, 140]} />
      <PerformanceMonitor
        onDecline={() => setTier((t) => (t > 0 ? ((t - 1) as 2 | 1 | 0) : t))}
        onIncline={() => setTier((t) => (t < 2 ? ((t + 1) as 2 | 1 | 0) : t))}
        flipflops={3}
        onFallback={() => setTier(0)}
      />
      <CameraRigV2 framing={framing} bounds={bounds} />
      {flag('stats') && (
        <Stats
          label={`${framing.kind} · post ${fx ? 'on' : 'off'} · tier ${tier}${flag('furniture') ? ' · furniture=glb' : ''}${flag('writers') ? ' · writers=parametric' : ''}`}
        />
      )}
      {/* environment: a cool sky dome and a warm paper strip above the studio, no network */}
      <Environment resolution={256} frames={1}>
        <Lightformer
          form="rect"
          intensity={1.2}
          color="#24405e"
          scale={[60, 30, 1]}
          position={[0, 20, -40]}
        />
        <Lightformer
          form="rect"
          intensity={0.6}
          color="#1c2127"
          scale={[60, 30, 1]}
          position={[-40, 10, 0]}
          rotation={[0, Math.PI / 2, 0]}
        />
        <Lightformer
          form="ring"
          intensity={2.2}
          color="#f1d3b4"
          scale={10}
          position={[10, 14, 10]}
        />
        <Lightformer
          form="rect"
          intensity={0.4}
          color="#1a1c1f"
          scale={[80, 80, 1]}
          position={[0, -10, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      </Environment>
      <hemisphereLight args={['#4a5663', '#1a1816', 0.55]} />
      <directionalLight
        position={[bounds.cx - 18, 26, bounds.cz - 10]}
        intensity={1.35}
        color="#d9e4ef"
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
          {rooms.map((room) => {
            const wall = WALLS[room.key] ?? WALLS['content']!
            const exec = room.key === 'executive'
            return (
              <Studio
                key={room.id}
                room={room}
                agents={snapshot?.agents ?? []}
                briefTitle={exec ? execTitle : contentTitle}
                briefLines={exec ? execLines : contentLines}
                wall={wall.images}
                wallLabel={wall.label}
              />
            )
          })}
        </BuildingV2>
      )}
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
        <EffectComposer enableNormalPass={false} multisampling={flag('msaa') ? 4 : 0}>
          {tier > 0 && !flag('noao') ? (
            <N8AO aoRadius={1.2} intensity={1.6} distanceFalloff={0.6} quality="low" halfRes />
          ) : (
            <></>
          )}
          {!flag('nobloom') ? (
            <Bloom luminanceThreshold={1.0} luminanceSmoothing={0.15} intensity={0.3} mipmapBlur />
          ) : (
            <></>
          )}
          {!flag('nosmaa') ? <SMAA /> : <></>}
          <Vignette eskil={false} offset={0.25} darkness={0.55} />
        </EffectComposer>
      )}
    </Canvas>
  )
}

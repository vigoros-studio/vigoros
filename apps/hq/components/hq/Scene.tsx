'use client'
import { Canvas } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { useMemo } from 'react'
import { boardroomPosition, buildingBounds, deskPosition, roomGeom, seatAround } from '@/lib/layout'
import { flag } from '@/lib/flags'
import { useHq } from '@/lib/store'
import { Avatar } from './Avatar'
import { Building } from './Building'
import { CameraRig } from './CameraRig'

/** The headquarters. Everything placed here is derived from the snapshot in the store. */
export function Scene() {
  const snapshot = useHq((s) => s.snapshot)
  const fx = !flag('nofx')
  /** Keeps the drawing buffer so a headless capture can read the canvas; off by default for performance. */
  const capture = flag('capture')
  const shadows = !flag('noshadow')
  const select = useHq((s) => s.select)
  const rooms = useMemo(() => (snapshot?.departments ?? []).map(roomGeom), [snapshot?.departments])
  const bounds = useMemo(() => (rooms.length ? buildingBounds(rooms) : { cx: 10, cz: 6 }), [rooms])
  const deskCount = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rooms)
      m.set(
        r.id,
        Math.max(
          2,
          snapshot?.agents.filter((a) => a.departmentId === r.id).length ?? 0,
          Math.min(6, r.d),
        ),
      )
    return m
  }, [rooms, snapshot?.agents])
  const exec = rooms.find((r) => r.key === 'executive')
  const table = exec ? boardroomPosition(exec) : null
  const meeting = (snapshot?.agents ?? []).filter((a) => a.state === 'meeting')

  return (
    <Canvas
      shadows={shadows}
      frameloop={capture ? 'demand' : 'always'}
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: capture }}
      onPointerMissed={() => select(null)}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at 50% 40%, #121216 0%, #08080a 70%)',
      }}
    >
      <color attach="background" args={['#08080a']} />
      {!flag('nofog') && <fog attach="fog" args={['#08080a', 40, 90]} />}
      <CameraRig center={{ x: bounds.cx, z: bounds.cz }} />
      <ambientLight intensity={0.4} color="#aab6ff" />
      <hemisphereLight args={['#2b3150', '#0a0a0c', 0.55]} />
      <directionalLight
        position={[-12, 18, -6]}
        intensity={0.8}
        color="#8ea0ff"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
      >
        <orthographicCamera attach="shadow-camera" args={[-30, 30, 30, -30, 1, 80]} />
      </directionalLight>
      {rooms.length > 0 && !flag('nobuilding') && <Building rooms={rooms} deskCount={deskCount} />}
      {!flag('noagents') &&
        snapshot?.agents.map((a) => {
          const room = rooms.find((r) => r.id === a.departmentId)
          if (!room) return null
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
      {fx && (
        <EffectComposer enableNormalPass={false}>
          <Bloom luminanceThreshold={0.85} luminanceSmoothing={0.2} intensity={0.9} mipmapBlur />
          <Vignette eskil={false} offset={0.2} darkness={0.75} />
        </EffectComposer>
      )}
    </Canvas>
  )
}

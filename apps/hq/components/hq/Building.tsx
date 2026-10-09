'use client'
import { Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  DEPARTMENT_TINT,
  boardroomPosition,
  buildingBounds,
  deskPosition,
  type RoomGeom,
} from '@/lib/layout'
import { flag } from '@/lib/flags'
import { useHq } from '@/lib/store'

const WALL = '#24242c'
const FLOOR = '#15151a'
const FLOOR_LIT = '#2b251c'
const WARM = '#ffd9a8'

/**
 * The building: a dark slab, rooms as low walls, desks and screens, the boardroom table.
 * Light is work: each room's lamp intensity follows the number of agents working in it,
 * read from the snapshot, never from a timer.
 */
export function Building({
  rooms,
  deskCount,
}: {
  rooms: RoomGeom[]
  deskCount: Map<string, number>
}) {
  const b = useMemo(() => buildingBounds(rooms), [rooms])
  return (
    <group>
      <mesh position={[b.cx, -0.26, b.cz]} receiveShadow>
        <boxGeometry args={[b.w + 2, 0.5, b.d + 2]} />
        <meshStandardMaterial color="#121216" roughness={0.95} />
      </mesh>
      {rooms.map((r) => (
        <Room key={r.id} room={r} desks={deskCount.get(r.id) ?? 0} />
      ))}
    </group>
  )
}

function Room({ room, desks }: { room: RoomGeom; desks: number }) {
  const select = useHq((s) => s.select)
  const setFocus = useHq((s) => s.setFocus)
  const selected = useHq((s) => s.selection)
  const isSelected = selected?.kind === 'department' && selected.id === room.id
  const lamp = useRef<THREE.PointLight>(null)
  const fixture = useRef<THREE.MeshStandardMaterial>(null)
  const floorMat = useRef<THREE.MeshStandardMaterial>(null)
  const target = Math.min(1, room.activity / Math.max(1, Math.min(desks, 3)))
  const tint = DEPARTMENT_TINT[room.key] ?? WARM

  useFrame((_, dt) => {
    // Smooth toward the activity level; the level itself only changes with the snapshot.
    const k = 1 - Math.exp(-dt * 2.5)
    if (lamp.current)
      lamp.current.intensity +=
        ((room.paused ? 0.3 : 0.9 + target * 2.8) - lamp.current.intensity) * k
    if (fixture.current)
      fixture.current.emissiveIntensity +=
        ((room.paused ? 0.05 : 0.2 + target * 2.6) - fixture.current.emissiveIntensity) * k
    if (floorMat.current) {
      const c = new THREE.Color(FLOOR).lerp(new THREE.Color(FLOOR_LIT), target)
      floorMat.current.color.lerp(c, k)
      floorMat.current.emissive.lerp(
        new THREE.Color(tint).multiplyScalar(0.08 * target + (isSelected ? 0.06 : 0)),
        k,
      )
    }
  })

  const wallH = 0.9
  const t = 0.12
  const onClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    select({ kind: 'department', id: room.id })
    setFocus({ x: room.cx, z: room.cz, zoom: 1.6 })
  }

  return (
    <group>
      <mesh
        position={[room.cx, 0, room.cz]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onClick={onClick}
      >
        <planeGeometry args={[room.w, room.d]} />
        <meshStandardMaterial ref={floorMat} color={FLOOR} roughness={0.9} />
      </mesh>
      {/* Walls: back and left are full height, front and right are low so the interior reads from the isometric camera. */}
      <mesh position={[room.cx, wallH / 2, room.z]} castShadow receiveShadow>
        <boxGeometry args={[room.w, wallH, t]} />
        <meshStandardMaterial color={WALL} roughness={0.8} />
      </mesh>
      <mesh position={[room.x, wallH / 2, room.cz]} castShadow receiveShadow>
        <boxGeometry args={[t, wallH, room.d]} />
        <meshStandardMaterial color={WALL} roughness={0.8} />
      </mesh>
      <mesh position={[room.cx, 0.12, room.z + room.d]} receiveShadow>
        <boxGeometry args={[room.w, 0.24, t]} />
        <meshStandardMaterial color={WALL} roughness={0.8} />
      </mesh>
      <mesh position={[room.x + room.w, 0.12, room.cz]} receiveShadow>
        <boxGeometry args={[t, 0.24, room.d]} />
        <meshStandardMaterial color={WALL} roughness={0.8} />
      </mesh>
      <pointLight
        ref={lamp}
        position={[room.cx, 2.2, room.cz]}
        color={WARM}
        intensity={0.9}
        distance={Math.max(room.w, room.d) * 1.5}
        decay={1.5}
        castShadow={false}
      />
      {/* The ceiling fixture: the thing that visibly glows when the room is working. */}
      <mesh position={[room.cx, 2.05, room.cz]}>
        <boxGeometry args={[Math.min(room.w * 0.35, 2.6), 0.04, 0.1]} />
        <meshStandardMaterial
          ref={fixture}
          color="#15130f"
          emissive={WARM}
          emissiveIntensity={0.35}
          transparent
          opacity={0.9}
        />
      </mesh>
      {Array.from({ length: desks }, (_, i) => {
        const p = deskPosition(room, i + 1)
        return <Desk key={i} x={p.x} z={p.z} />
      })}
      {room.key === 'executive' && <Boardroom room={room} />}
      {!flag('notext') && (
        <Text
          position={[room.x + 0.3, 1.0, room.z + 0.35]}
          rotation={[0, 0, 0]}
          fontSize={0.3}
          color="#b4b4bc"
          anchorX="left"
          anchorY="bottom"
          fillOpacity={0.95}
        >
          {room.name.toUpperCase()}
        </Text>
      )}
    </group>
  )
}

function Desk({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.36, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.3, 0.06, 0.65]} />
        <meshStandardMaterial color="#3a3a44" roughness={0.6} metalness={0.1} />
      </mesh>
      {[-0.5, 0.5].map((dx) => (
        <mesh key={dx} position={[dx, 0.17, 0]}>
          <boxGeometry args={[0.06, 0.34, 0.5]} />
          <meshStandardMaterial color="#2a2a32" />
        </mesh>
      ))}
    </group>
  )
}

function Boardroom({ room }: { room: RoomGeom }) {
  const select = useHq((s) => s.select)
  const setFocus = useHq((s) => s.setFocus)
  const pending = useHq((s) => s.snapshot?.pendingApprovals.length ?? 0)
  const p = boardroomPosition(room)
  const glow = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(({ clock }) => {
    if (glow.current)
      glow.current.emissiveIntensity =
        pending > 0 ? 0.9 + Math.sin(clock.elapsedTime * 2.2) * 0.35 : 0.08
  })
  return (
    <group
      position={[p.x, 0, p.z]}
      onClick={(e) => {
        if (e.delta > 6) return
        e.stopPropagation()
        select({ kind: 'boardroom' })
        setFocus({ x: p.x, z: p.z, zoom: 1.8 })
      }}
    >
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.6, 0.08, 1.3]} />
        <meshStandardMaterial color="#2b2630" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[0.6, 0.4, 0.4]} />
        <meshStandardMaterial color="#1b1b20" />
      </mesh>
      {/* The queue lamp: pink when the founder has decisions waiting. */}
      <mesh position={[0, 0.47, 0]}>
        <boxGeometry args={[0.5, 0.05, 0.3]} />
        <meshStandardMaterial
          ref={glow}
          color="#f28bb5"
          emissive="#f28bb5"
          emissiveIntensity={0.1}
        />
      </mesh>
      {!flag('notext') && (
        <Text
          position={[0, 1.05, 0]}
          fontSize={0.22}
          color="#f28bb5"
          anchorX="center"
          anchorY="bottom"
        >
          {pending > 0 ? `${pending} awaiting you` : 'BOARDROOM'}
        </Text>
      )}
    </group>
  )
}

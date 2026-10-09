'use client'
import { Text } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { flag } from '@/lib/flags'
import { buildingBounds, type RoomGeom } from '@/lib/layout'
import { useHq } from '@/lib/store'
import { Pendant, Rug } from './Furniture'
import { M, PALETTE, roundedBox } from './materials'

export const WALL_H = 2.8
export const WALL_T = 0.15
export const SHELL_T = 0.25
export const SLAB_H = 0.3

/**
 * The building shell: a raised slab, charcoal exterior walls with full-height glazing on the two
 * faces the camera sees, interior partitions in off-white, glass partitions with doors between
 * departments, oak floors, a rug and a pendant per room. Rooms come from the database floor plan.
 */
export function BuildingV2({ rooms, children }: { rooms: RoomGeom[]; children?: React.ReactNode }) {
  const b = useMemo(() => buildingBounds(rooms), [rooms])
  const maxX = Math.max(...rooms.map((r) => r.x + r.w))
  const maxZ = Math.max(...rooms.map((r) => r.z + r.d))
  const minX = Math.min(...rooms.map((r) => r.x))
  const minZ = Math.min(...rooms.map((r) => r.z))
  return (
    <group>
      {/* ground, far and dark, slightly reflective so the lit building sits in the night */}
      <mesh position={[b.cx, -SLAB_H - 0.01, b.cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[220, 220]} />
        <primitive object={M.ground()} attach="material" />
      </mesh>
      {/* slab with a terrace margin */}
      <mesh
        geometry={roundedBox(maxX - minX + 3, SLAB_H, maxZ - minZ + 3, 0.04)}
        material={M.slab()}
        position={[(minX + maxX) / 2, -SLAB_H / 2, (minZ + maxZ) / 2]}
        receiveShadow
        castShadow
      />
      {/* floor over the whole footprint */}
      <mesh
        position={[(minX + maxX) / 2, 0.001, (minZ + maxZ) / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[maxX - minX, maxZ - minZ]} />
        <primitive object={M.floor()} attach="material" />
      </mesh>
      {/* exterior shell: solid on the far faces, glazed on the near faces */}
      <Wall
        from={[minX - SHELL_T / 2, minZ]}
        to={[minX - SHELL_T / 2, maxZ]}
        t={SHELL_T}
        material={M.charcoal()}
      />
      <Wall
        from={[minX, minZ - SHELL_T / 2]}
        to={[maxX, minZ - SHELL_T / 2]}
        t={SHELL_T}
        material={M.charcoal()}
      />
      <Glazing
        from={[maxX + SHELL_T / 2, minZ - SHELL_T]}
        to={[maxX + SHELL_T / 2, maxZ + SHELL_T]}
      />
      <Glazing
        from={[minX - SHELL_T, maxZ + SHELL_T / 2]}
        to={[maxX + SHELL_T, maxZ + SHELL_T / 2]}
      />
      {/* roof fascia along the far walls so the top edge reads as a building */}
      <mesh
        geometry={roundedBox(maxX - minX + 2 * SHELL_T, 0.12, SHELL_T + 0.1, 0.02)}
        material={M.charcoal()}
        position={[(minX + maxX) / 2, WALL_H + 0.06, minZ - SHELL_T / 2]}
      />
      <mesh
        geometry={roundedBox(SHELL_T + 0.1, 0.12, maxZ - minZ + 2 * SHELL_T, 0.02)}
        material={M.charcoal()}
        position={[minX - SHELL_T / 2, WALL_H + 0.06, (minZ + maxZ) / 2]}
      />
      {rooms.map((r) => (
        <Room key={r.id} room={r} minX={minX} minZ={minZ} maxX={maxX} maxZ={maxZ} />
      ))}
      {children}
    </group>
  )
}

function Wall({
  from,
  to,
  t,
  material,
  h = WALL_H,
}: {
  from: [number, number]
  to: [number, number]
  t: number
  material: THREE.Material
  h?: number
}) {
  const dx = to[0] - from[0]
  const dz = to[1] - from[1]
  const len = Math.hypot(dx, dz)
  const ang = Math.atan2(dx, dz)
  return (
    <group position={[(from[0] + to[0]) / 2, h / 2, (from[1] + to[1]) / 2]} rotation={[0, ang, 0]}>
      <mesh material={material} castShadow receiveShadow>
        <boxGeometry args={[t, h, len]} />
      </mesh>
      {/* skirting */}
      <mesh material={M.charcoal()} position={[0, -h / 2 + 0.05, 0]}>
        <boxGeometry args={[t + 0.02, 0.1, len]} />
      </mesh>
    </group>
  )
}

/** Full-height glass with charcoal mullions every 1.5 m and a sill. */
function Glazing({ from, to }: { from: [number, number]; to: [number, number] }) {
  const dx = to[0] - from[0]
  const dz = to[1] - from[1]
  const len = Math.hypot(dx, dz)
  const ang = Math.atan2(dx, dz)
  const n = Math.max(1, Math.round(len / 1.5))
  return (
    <group
      position={[(from[0] + to[0]) / 2, WALL_H / 2, (from[1] + to[1]) / 2]}
      rotation={[0, ang, 0]}
    >
      <mesh material={M.glass()}>
        <boxGeometry args={[0.02, WALL_H - 0.3, len]} />
      </mesh>
      <mesh material={M.charcoal()} position={[0, -WALL_H / 2 + 0.1, 0]}>
        <boxGeometry args={[SHELL_T, 0.2, len]} />
      </mesh>
      <mesh material={M.charcoal()} position={[0, WALL_H / 2 - 0.05, 0]}>
        <boxGeometry args={[SHELL_T, 0.12, len]} />
      </mesh>
      {Array.from({ length: n + 1 }, (_, i) => (
        <mesh key={i} material={M.charcoal()} position={[0, 0, -len / 2 + (i * len) / n]}>
          <boxGeometry args={[0.08, WALL_H - 0.3, 0.06]} />
        </mesh>
      ))}
    </group>
  )
}

/** A glass partition with a door opening, between two departments. */
function Partition({
  from,
  to,
  doorAt,
}: {
  from: [number, number]
  to: [number, number]
  doorAt: number
}) {
  const dx = to[0] - from[0]
  const dz = to[1] - from[1]
  const len = Math.hypot(dx, dz)
  const ang = Math.atan2(dx, dz)
  const door = 0.95
  const a = doorAt - door / 2
  const bLen = len - doorAt - door / 2
  return (
    <group position={[from[0], 0, from[1]]} rotation={[0, ang, 0]}>
      {/* solid low wall then glass above on each side of the door */}
      {[
        { z: a / 2, l: a },
        { z: doorAt + door / 2 + bLen / 2, l: bLen },
      ].map((s, i) => (
        <group key={i} position={[0, 0, s.z]}>
          <mesh material={M.wall()} position={[0, 0.45, 0]} castShadow receiveShadow>
            <boxGeometry args={[WALL_T, 0.9, s.l]} />
          </mesh>
          <mesh material={M.glass()} position={[0, 0.9 + (WALL_H - 0.9) / 2, 0]}>
            <boxGeometry args={[0.02, WALL_H - 0.9, s.l]} />
          </mesh>
          <mesh material={M.charcoal()} position={[0, 0.92, 0]}>
            <boxGeometry args={[WALL_T, 0.05, s.l]} />
          </mesh>
          <mesh material={M.charcoal()} position={[0, WALL_H - 0.04, 0]}>
            <boxGeometry args={[WALL_T, 0.08, s.l]} />
          </mesh>
        </group>
      ))}
      {/* door frame and an open door leaf */}
      <group position={[0, 0, doorAt]}>
        {[-door / 2, door / 2].map((z) => (
          <mesh key={z} material={M.charcoal()} position={[0, 1.05, z]}>
            <boxGeometry args={[WALL_T + 0.02, 2.1, 0.06]} />
          </mesh>
        ))}
        <mesh material={M.charcoal()} position={[0, 2.13, 0]}>
          <boxGeometry args={[WALL_T + 0.02, 0.06, door + 0.06]} />
        </mesh>
        <mesh
          material={M.plastic('#3a3328')}
          position={[0.35, 1.03, -door / 2 + 0.02]}
          rotation={[0, 1.2, 0]}
          castShadow
        >
          <boxGeometry args={[0.04, 2.0, door - 0.08]} />
        </mesh>
        <mesh material={M.glass()} position={[0, WALL_H - 0.33, 0]}>
          <boxGeometry args={[0.02, 0.58, door]} />
        </mesh>
      </group>
    </group>
  )
}

function Room({
  room,
  minX,
  minZ,
  maxX,
  maxZ,
}: {
  room: RoomGeom
  minX: number
  minZ: number
  maxX: number
  maxZ: number
}) {
  const select = useHq((s) => s.select)
  const accent = PALETTE.accents[room.key] ?? '#999'
  const x0 = room.x
  const z0 = room.z
  const x1 = room.x + room.w
  const z1 = room.z + room.d
  const interiorLeft = x0 > minX + 0.01
  const interiorBack = z0 > minZ + 0.01
  const interiorRight = x1 < maxX - 0.01
  const interiorFront = z1 < maxZ - 0.01
  return (
    <group>
      {/* clickable floor */}
      <mesh
        position={[room.cx, 0.002, room.cz]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
        onClick={(e) => {
          e.stopPropagation()
          select({ kind: 'department', id: room.id })
        }}
      >
        <planeGeometry args={[room.w, room.d]} />
      </mesh>
      {/* solid walls on the far sides; the back wall carries the accent */}
      {interiorBack && <Wall from={[x0, z0]} to={[x1, z0]} t={WALL_T} material={M.wall()} />}
      {interiorLeft && <Wall from={[x0, z0]} to={[x0, z1]} t={WALL_T} material={M.wall()} />}
      {/* feature wall panel: a thin accent skin on the back wall's inner face */}
      <mesh
        geometry={roundedBox(Math.min(room.w * 0.6, 6), WALL_H - 0.6, 0.03, 0.01)}
        material={M.accent(room.key)}
        position={[
          room.cx,
          (WALL_H - 0.6) / 2 + 0.3,
          z0 + (interiorBack ? WALL_T / 2 : SHELL_T / 2 - 0.1) + 0.02,
        ]}
        receiveShadow
      />
      {/* glass partitions on the near sides where another room follows */}
      {interiorRight && <Partition from={[x1, z0]} to={[x1, z1]} doorAt={room.d - 1.2} />}
      {interiorFront && <Partition from={[x0, z1]} to={[x1, z1]} doorAt={1.2} />}
      <group position={[room.cx, 0, room.cz]}>
        <Rug w={Math.min(room.w - 2.5, 6)} d={Math.min(room.d - 2.5, 4)} accent={room.key} />
      </group>
      <group position={[room.cx, 0, room.cz]}>
        <Pendant intensity={2.4} />
      </group>
      {!flag('notext') && (
        <Text
          position={[
            room.cx - Math.min(room.w * 0.6, 6) / 2 + 0.25,
            2.5,
            z0 + 0.12 + (interiorBack ? WALL_T / 2 : 0),
          ]}
          fontSize={0.2}
          color="#f4f1ea"
          anchorX="left"
          anchorY="middle"
          letterSpacing={0.12}
          outlineWidth={0.004}
          outlineColor={accent}
        >
          {room.name.toUpperCase()}
        </Text>
      )}
    </group>
  )
}

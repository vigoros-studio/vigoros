'use client'
import { Text } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { flag } from '@/lib/flags'
import { buildingBounds, type RoomGeom } from '@/lib/layout'
import { useHq } from '@/lib/store'
import { type Batch, box } from './batch'
import { Batched } from './Batched'
import { addPendantBody, addRug, PendantLight } from './Furniture'
import { M, PALETTE, roundedBox } from './materials'

export const WALL_H = 2.8
export const WALL_T = 0.15
export const SHELL_T = 0.25
export const SLAB_H = 0.3

/**
 * The building shell: a raised slab, charcoal exterior walls with full-height glazing on the two
 * faces the camera sees, interior partitions in off-white, glass partitions with doors between
 * departments, oak floors, a rug and a pendant per room. Rooms come from the database floor plan.
 * The whole shell is one static batch: a dozen draw calls for the entire building.
 */
export function BuildingV2({ rooms, children }: { rooms: RoomGeom[]; children?: React.ReactNode }) {
  const b = useMemo(() => buildingBounds(rooms), [rooms])
  const maxX = Math.max(...rooms.map((r) => r.x + r.w))
  const maxZ = Math.max(...rooms.map((r) => r.z + r.d))
  const minX = Math.min(...rooms.map((r) => r.x))
  const minZ = Math.min(...rooms.map((r) => r.z))
  const key = rooms.map((r) => `${r.id}:${r.x},${r.z},${r.w},${r.d}`).join('|')
  return (
    <group>
      {/* ground, far and dark, slightly reflective so the lit building sits in the night */}
      <mesh
        position={[b.cx, -SLAB_H - 0.01, b.cz]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        raycast={() => null}
      >
        <planeGeometry args={[220, 220]} />
        <primitive object={M.ground()} attach="material" />
      </mesh>
      {/* floor over the whole footprint, textured so it stays its own mesh */}
      <mesh
        position={[(minX + maxX) / 2, 0.001, (minZ + maxZ) / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        raycast={() => null}
      >
        <planeGeometry args={[maxX - minX, maxZ - minZ]} />
        <primitive object={M.floor()} attach="material" />
      </mesh>
      <Batched
        deps={[key]}
        build={(bt) => {
          addSlab(bt, minX, minZ, maxX, maxZ)
          addShell(bt, minX, minZ, maxX, maxZ)
          for (const r of rooms) addRoom(bt, r, minX, minZ, maxX, maxZ)
        }}
      />
      {rooms.map((r) => (
        <RoomLive key={r.id} room={r} minZ={minZ} />
      ))}
      {children}
    </group>
  )
}

const addSlab = (b: Batch, minX: number, minZ: number, maxX: number, maxZ: number) => {
  b.add(roundedBox(maxX - minX + 3, SLAB_H, maxZ - minZ + 3, 0.04), M.slab(), [
    (minX + maxX) / 2,
    -SLAB_H / 2,
    (minZ + maxZ) / 2,
  ])
}

const addShell = (b: Batch, minX: number, minZ: number, maxX: number, maxZ: number) => {
  addWall(b, [minX - SHELL_T / 2, minZ], [minX - SHELL_T / 2, maxZ], SHELL_T, M.charcoal())
  addWall(b, [minX, minZ - SHELL_T / 2], [maxX, minZ - SHELL_T / 2], SHELL_T, M.charcoal())
  addGlazing(b, [maxX + SHELL_T / 2, minZ - SHELL_T], [maxX + SHELL_T / 2, maxZ + SHELL_T])
  addGlazing(b, [minX - SHELL_T, maxZ + SHELL_T / 2], [maxX + SHELL_T, maxZ + SHELL_T / 2])
  // roof fascia along the far walls so the top edge reads as a building
  b.add(roundedBox(maxX - minX + 2 * SHELL_T, 0.12, SHELL_T + 0.1, 0.02), M.charcoal(), [
    (minX + maxX) / 2,
    WALL_H + 0.06,
    minZ - SHELL_T / 2,
  ])
  b.add(roundedBox(SHELL_T + 0.1, 0.12, maxZ - minZ + 2 * SHELL_T, 0.02), M.charcoal(), [
    minX - SHELL_T / 2,
    WALL_H + 0.06,
    (minZ + maxZ) / 2,
  ])
}

const addWall = (
  b: Batch,
  from: [number, number],
  to: [number, number],
  t: number,
  material: THREE.Material,
  h = WALL_H,
) => {
  const dx = to[0] - from[0]
  const dz = to[1] - from[1]
  const len = Math.hypot(dx, dz)
  const ang = Math.atan2(dx, dz)
  b.push([(from[0] + to[0]) / 2, h / 2, (from[1] + to[1]) / 2], [0, ang, 0])
  b.add(box(1, 1, 1), material, [0, 0, 0], [0, 0, 0], [t, h, len])
  // skirting
  b.add(box(1, 1, 1), M.charcoal(), [0, -h / 2 + 0.05, 0], [0, 0, 0], [t + 0.02, 0.1, len])
  b.pop()
}

/** Full-height glass with charcoal mullions every 1.5 m and a sill. */
const addGlazing = (b: Batch, from: [number, number], to: [number, number]) => {
  const dx = to[0] - from[0]
  const dz = to[1] - from[1]
  const len = Math.hypot(dx, dz)
  const ang = Math.atan2(dx, dz)
  const n = Math.max(1, Math.round(len / 1.5))
  b.push([(from[0] + to[0]) / 2, WALL_H / 2, (from[1] + to[1]) / 2], [0, ang, 0])
  b.add(box(1, 1, 1), M.glass(), [0, 0, 0], [0, 0, 0], [0.02, WALL_H - 0.3, len], {
    castShadow: false,
    receiveShadow: false,
  })
  b.add(box(1, 1, 1), M.charcoal(), [0, -WALL_H / 2 + 0.1, 0], [0, 0, 0], [SHELL_T, 0.2, len])
  b.add(box(1, 1, 1), M.charcoal(), [0, WALL_H / 2 - 0.05, 0], [0, 0, 0], [SHELL_T, 0.12, len])
  for (let i = 0; i <= n; i++)
    b.add(
      box(1, 1, 1),
      M.charcoal(),
      [0, 0, -len / 2 + (i * len) / n],
      [0, 0, 0],
      [0.08, WALL_H - 0.3, 0.06],
    )
  b.pop()
}

/** A glass partition with a door opening, between two departments. */
const addPartition = (b: Batch, from: [number, number], to: [number, number], doorAt: number) => {
  const dx = to[0] - from[0]
  const dz = to[1] - from[1]
  const len = Math.hypot(dx, dz)
  const ang = Math.atan2(dx, dz)
  const door = 0.95
  const a = doorAt - door / 2
  const bLen = len - doorAt - door / 2
  b.push([from[0], 0, from[1]], [0, ang, 0])
  for (const s of [
    { z: a / 2, l: a },
    { z: doorAt + door / 2 + bLen / 2, l: bLen },
  ]) {
    if (s.l <= 0.01) continue
    b.push([0, 0, s.z])
    b.add(box(1, 1, 1), M.wall(), [0, 0.45, 0], [0, 0, 0], [WALL_T, 0.9, s.l])
    b.add(
      box(1, 1, 1),
      M.glass(),
      [0, 0.9 + (WALL_H - 0.9) / 2, 0],
      [0, 0, 0],
      [0.02, WALL_H - 0.9, s.l],
      { castShadow: false, receiveShadow: false },
    )
    b.add(box(1, 1, 1), M.charcoal(), [0, 0.92, 0], [0, 0, 0], [WALL_T, 0.05, s.l])
    b.add(box(1, 1, 1), M.charcoal(), [0, WALL_H - 0.04, 0], [0, 0, 0], [WALL_T, 0.08, s.l])
    b.pop()
  }
  // door frame and an open door leaf
  b.push([0, 0, doorAt])
  for (const z of [-door / 2, door / 2])
    b.add(box(1, 1, 1), M.charcoal(), [0, 1.05, z], [0, 0, 0], [WALL_T + 0.02, 2.1, 0.06])
  b.add(box(1, 1, 1), M.charcoal(), [0, 2.13, 0], [0, 0, 0], [WALL_T + 0.02, 0.06, door + 0.06])
  b.add(
    box(1, 1, 1),
    M.plastic('#3a3328'),
    [0.35, 1.03, -door / 2 + 0.02],
    [0, 1.2, 0],
    [0.04, 2.0, door - 0.08],
  )
  b.add(box(1, 1, 1), M.glass(), [0, WALL_H - 0.33, 0], [0, 0, 0], [0.02, 0.58, door], {
    castShadow: false,
    receiveShadow: false,
  })
  b.pop()
  b.pop()
}

const addRoom = (
  b: Batch,
  room: RoomGeom,
  minX: number,
  minZ: number,
  maxX: number,
  maxZ: number,
) => {
  const x0 = room.x
  const z0 = room.z
  const x1 = room.x + room.w
  const z1 = room.z + room.d
  const interiorLeft = x0 > minX + 0.01
  const interiorBack = z0 > minZ + 0.01
  const interiorRight = x1 < maxX - 0.01
  const interiorFront = z1 < maxZ - 0.01
  if (interiorBack) addWall(b, [x0, z0], [x1, z0], WALL_T, M.wall())
  if (interiorLeft) addWall(b, [x0, z0], [x0, z1], WALL_T, M.wall())
  // feature wall panel: a thin accent skin on the back wall's inner face
  b.add(
    roundedBox(Math.min(room.w * 0.6, 6), WALL_H - 0.6, 0.03, 0.01),
    M.accent(room.key),
    [
      room.cx,
      (WALL_H - 0.6) / 2 + 0.3,
      z0 + (interiorBack ? WALL_T / 2 : SHELL_T / 2 - 0.1) + 0.02,
    ],
    [0, 0, 0],
    1,
    { castShadow: false },
  )
  if (interiorRight) addPartition(b, [x1, z0], [x1, z1], room.d - 1.2)
  if (interiorFront) addPartition(b, [x0, z1], [x1, z1], 1.2)
  b.push([room.cx, 0, room.cz])
  addRug(b, Math.min(room.w - 2.5, 6), Math.min(room.d - 2.5, 4), room.key)
  addPendantBody(b)
  b.pop()
}

/** The parts of a room that answer input or emit light: the clickable floor, the pendant, the sign. */
function RoomLive({ room, minZ }: { room: RoomGeom; minZ: number }) {
  const select = useHq((s) => s.select)
  const accent = PALETTE.accents[room.key] ?? '#999'
  const interiorBack = room.z > minZ + 0.01
  return (
    <group>
      <mesh
        position={[room.cx, 0.002, room.cz]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
        onClick={(e) => {
          if (e.delta > 6) return // a drag, not a click
          e.stopPropagation()
          select({ kind: 'department', id: room.id })
        }}
      >
        <planeGeometry args={[room.w, room.d]} />
      </mesh>
      <group position={[room.cx, 0, room.cz]}>
        <PendantLight intensity={2.4} />
      </group>
      {!flag('notext') && (
        <Text
          position={[
            room.cx - Math.min(room.w * 0.6, 6) / 2 + 0.25,
            2.5,
            room.z + 0.12 + (interiorBack ? WALL_T / 2 : 0),
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

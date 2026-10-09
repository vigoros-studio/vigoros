import type { Snapshot } from '@vigoros/ops'

/**
 * World geometry derived from the department rooms stored in the database. One tile = one unit.
 * Everything the scene places (rooms, desks, the boardroom, avatars) comes from here, so the HQ
 * and the 2D views agree on where things are.
 */
export const TILE = 1

export interface RoomGeom {
  id: string
  key: string
  name: string
  x: number
  z: number
  w: number
  d: number
  cx: number
  cz: number
  activity: number
  paused: boolean
}

export const roomGeom = (dep: Snapshot['departments'][number]): RoomGeom => {
  const [ox, oz] = dep.room.origin
  const [w, d] = dep.room.size
  return {
    id: dep.id,
    key: dep.key,
    name: dep.name,
    x: ox,
    z: oz,
    w,
    d,
    cx: ox + w / 2,
    cz: oz + d / 2,
    activity: dep.activity,
    paused: dep.paused,
  }
}

/** Desk positions inside a room, two rows along the long side. Executive rooms keep the right half for the boardroom. */
export const deskPosition = (
  room: RoomGeom,
  desk: number,
): { x: number; z: number; facing: number } => {
  const usableW = room.key === 'executive' ? room.w * 0.5 : room.w
  const cols = Math.max(1, Math.floor((usableW - 1.5) / 2))
  const i = Math.max(0, desk - 1)
  const col = i % cols
  const row = Math.floor(i / cols)
  const x = room.x + 1.25 + col * 2 + 0.5
  const z = room.z + 1.5 + row * 2.2
  return { x, z, facing: 0 }
}

export const boardroomPosition = (room: RoomGeom): { x: number; z: number } => ({
  x: room.x + room.w * 0.75,
  z: room.cz,
})

export const seatAround = (
  center: { x: number; z: number },
  index: number,
  count: number,
): { x: number; z: number } => {
  const a = (index / Math.max(1, count)) * Math.PI * 2
  return { x: center.x + Math.cos(a) * 1.6, z: center.z + Math.sin(a) * 1.1 }
}

export const buildingBounds = (rooms: RoomGeom[]) => {
  const minX = Math.min(...rooms.map((r) => r.x)) - 1
  const minZ = Math.min(...rooms.map((r) => r.z)) - 1
  const maxX = Math.max(...rooms.map((r) => r.x + r.w)) + 1
  const maxZ = Math.max(...rooms.map((r) => r.z + r.d)) + 1
  return {
    minX,
    minZ,
    maxX,
    maxZ,
    cx: (minX + maxX) / 2,
    cz: (minZ + maxZ) / 2,
    w: maxX - minX,
    d: maxZ - minZ,
  }
}

export const DEPARTMENT_TINT: Record<string, string> = {
  executive: '#c9b8ff',
  creative: '#ffd58a',
  production: '#8ad4ff',
  growth: '#9ff0c4',
  commercial: '#ffc2a1',
  operations: '#d0d0d8',
}

export const STATE_LABEL: Record<string, string> = {
  working: 'working',
  reviewing: 'reviewing',
  meeting: 'in a meeting',
  waiting: 'waiting',
  blocked: 'blocked',
  completed: 'just finished',
  idle: 'idle',
}

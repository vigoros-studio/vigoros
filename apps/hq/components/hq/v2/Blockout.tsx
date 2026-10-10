'use client'
import type { RoomGeom } from '@/lib/layout'
import { deskPosition } from '@/lib/layout'
import { Batched } from './Batched'
import { M, roundedBox } from './materials'

/** Neutral grey block-out desks for rooms that have not had their art pass yet. Honest placeholders, one batch. */
export function Blockout({
  rooms,
  deskCount,
}: {
  rooms: RoomGeom[]
  deskCount: Map<string, number>
}) {
  const key = rooms.map((r) => `${r.id}:${deskCount.get(r.id) ?? 0}`).join('|')
  return (
    <Batched
      deps={[key]}
      build={(b) => {
        for (const room of rooms)
          for (let i = 0; i < (deskCount.get(room.id) ?? 0); i++) {
            const p = deskPosition(room, i + 1)
            b.push([p.x, 0, p.z])
            b.add(roundedBox(1.3, 0.05, 0.65, 0.01), M.plastic('#3a3a42'), [0, 0.72, 0])
            for (const dx of [-0.55, 0.55])
              b.add(roundedBox(0.05, 0.7, 0.55, 0.01), M.plastic('#2e2e35'), [dx, 0.35, 0])
            b.add(
              roundedBox(0.5, 0.3, 0.03, 0.006),
              M.plastic('#26262c'),
              [0, 0.95, -0.15],
              [-0.1, 0, 0],
            )
            b.pop()
          }
      }}
    />
  )
}

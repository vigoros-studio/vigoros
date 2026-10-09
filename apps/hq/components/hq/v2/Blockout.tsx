'use client'
import type { RoomGeom } from '@/lib/layout'
import { deskPosition } from '@/lib/layout'
import { M, roundedBox } from './materials'

/** Neutral grey block-out desks for rooms that have not had their art pass yet. Honest placeholders. */
export function Blockout({
  rooms,
  deskCount,
}: {
  rooms: RoomGeom[]
  deskCount: Map<string, number>
}) {
  return (
    <group>
      {rooms.map((room) =>
        Array.from({ length: deskCount.get(room.id) ?? 0 }, (_, i) => {
          const p = deskPosition(room, i + 1)
          return (
            <group key={`${room.id}-${i}`} position={[p.x, 0, p.z]}>
              <mesh
                geometry={roundedBox(1.3, 0.05, 0.65, 0.01)}
                material={M.plastic('#3a3a42')}
                position={[0, 0.72, 0]}
                castShadow
                receiveShadow
              />
              {[-0.55, 0.55].map((dx) => (
                <mesh
                  key={dx}
                  geometry={roundedBox(0.05, 0.7, 0.55, 0.01)}
                  material={M.plastic('#2e2e35')}
                  position={[dx, 0.35, 0]}
                  castShadow
                />
              ))}
              <mesh
                geometry={roundedBox(0.5, 0.3, 0.03, 0.006)}
                material={M.plastic('#26262c')}
                position={[0, 0.95, -0.15]}
                rotation={[-0.1, 0, 0]}
                castShadow
              />
            </group>
          )
        }),
      )}
    </group>
  )
}

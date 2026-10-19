'use client'
import { Billboard, Text, useGLTF } from '@react-three/drei'
import type { Snapshot } from '@vigoros/ops'
import { Suspense, useMemo, useState } from 'react'
import * as THREE from 'three'
import { flag } from '@/lib/flags'
import type { RoomGeom } from '@/lib/layout'
import { useHq } from '@/lib/store'
import { type Batch } from './batch'
import { Batched } from './Batched'
import { WALL_T } from './BuildingV2'
import {
  addBookshelf,
  addChair,
  addDesk,
  addHeadphones,
  addKeyboard,
  addLampBody,
  addMonitorBody,
  addMoodBoardFrame,
  addMug,
  addNotebook,
  addPcBox,
  addPendantBody,
  addPlant,
  addWhiteboardFrame,
  LampLight,
  MonitorScreen,
  MoodBoardPhotos,
  PendantLight,
  StatusLed,
  WhiteboardSurface,
} from './Furniture'
import { addKayKit, kaykitUrl, type KayKitModel } from './KayKit'
import { PALETTE } from './materials'
import { RIGGED_LOOKS, RiggedWriter } from './RiggedWriter'
import { LOOKS, Writer } from './Writer'

type AgentRow = Snapshot['agents'][number]

/**
 * World position of an agent's workstation inside a room, by its index among the room's agents.
 * One person sits centred facing east; two share a desk facing each other; more spread along
 * the room. Exported so the camera can frame the person.
 */
export const stationFor = (
  room: RoomGeom,
  index: number,
  count: number,
): { x: number; z: number; facing: number } => {
  const cx = room.x + room.w * 0.52
  const cz = room.z + room.d * 0.55
  if (count <= 1) return { x: cx, z: cz, facing: -Math.PI / 2 }
  if (count === 2)
    return index === 0
      ? { x: cx - 1.0, z: cz, facing: -Math.PI / 2 }
      : { x: cx + 1.0, z: cz, facing: Math.PI / 2 }
  const span = Math.min(room.w - 3, (count - 1) * 2.2)
  return {
    x: room.x + room.w / 2 - span / 2 + (span * index) / (count - 1),
    z: cz,
    facing: 0,
  }
}

const chairColorFor = (key: string) =>
  new THREE.Color(PALETTE.accents[key] ?? '#4a5663').multiplyScalar(0.7).getStyle()

/**
 * A finished room: a workstation per agent with a live monitor, the wall board with the brand's
 * images, the whiteboard with the current brief, a bookshelf, plants, pendants. Everything an
 * agent does here comes from the snapshot row; nothing animates work without a run. All static
 * furniture is one batch; the live parts (screens, lamps, LEDs, the people) sit over it.
 */
export function Studio({
  room,
  agents,
  briefTitle,
  briefLines,
  wall,
  wallLabel,
}: {
  room: RoomGeom
  agents: AgentRow[]
  briefTitle: string
  briefLines: string[]
  wall: string[]
  wallLabel: string
}) {
  const members = agents.filter((a) => a.departmentId === room.id)
  const backZ = room.z + WALL_T / 2 + 0.03
  const leftX = room.x + WALL_T / 2 + 0.03
  const stations = members.map((a, i) => ({ agent: a, ...stationFor(room, i, members.length) }))
  const key = `${room.id}:${room.x},${room.z},${room.w},${room.d}:${stations.map((s) => s.agent.roleKey).join(',')}`
  const glb = flag('furniture')
  const stationList = stations.map((s) => ({
    x: s.x,
    z: s.z,
    facing: s.facing,
    roleKey: s.agent.roleKey,
  }))
  const chairColor = chairColorFor(room.key)
  return (
    <group>
      {glb ? (
        <Suspense fallback={null}>
          <AuthoredFurniture
            room={room}
            stations={stationList}
            batchKey={key}
            wallCount={wall.length}
          />
        </Suspense>
      ) : (
        <Batched
          deps={[key, wall.length]}
          build={(b) => {
            addBrandWall(b, room, wall.length)
            b.at([leftX + 0.17, 0, room.z + room.d * 0.78], [0, Math.PI / 2, 0], () =>
              addBookshelf(b, 1.3, room.key),
            )
            b.at([room.x + 0.5, 0, room.z + 0.5], [0, 0, 0], () => addPlant(b, 1.2))
            b.at([room.x + room.w - 0.6, 0, room.z + room.d - 0.6], [0, 0, 0], () =>
              addPlant(b, 0.9),
            )
            for (const s of stationList) {
              const look = LOOKS[s.roleKey] ?? LOOKS['managing-director']!
              b.push([s.x, 0, s.z], [0, s.facing, 0])
              addDesk(b)
              addMonitorBody(b)
              addKeyboard(b)
              addLampBody(b, look.hairStyle === 'bun' ? -1 : 1)
              if (look.hairStyle === 'bun') {
                addHeadphones(b)
                addMug(b, '#dfe8e3', -0.45)
              } else {
                addMug(b, '#1a1c1f')
                addNotebook(b)
              }
              addPcBox(b)
              b.at([0, 0, 0.72], [0, 0, 0], () => addChair(b, chairColor, Math.PI))
              addPendantBody(b, 2.8, 1.0)
              b.pop()
            }
          }}
        />
      )}
      <group position={[room.x + room.w * 0.55, 1.55, backZ + 0.03]}>
        <MoodBoardPhotos images={wall} />
      </group>
      <group position={[leftX + 0.03, 1.45, room.z + room.d * 0.42]} rotation={[0, Math.PI / 2, 0]}>
        <WhiteboardSurface title={briefTitle} lines={briefLines} />
      </group>
      {stations.map((s) => (
        <Workstation key={s.agent.id} agent={s.agent} x={s.x} z={s.z} facing={s.facing} />
      ))}
      {!flag('notext') && (
        <Text
          position={[room.x + room.w * 0.55, 2.38, backZ + 0.06]}
          fontSize={0.14}
          color="#faf8f4"
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.2}
          outlineWidth={0.003}
          outlineColor={PALETTE.accents[room.key] ?? '#4a5663'}
        >
          {wallLabel}
        </Text>
      )}
    </group>
  )
}

/** The brand wall: the pin board frame and the whiteboard frame. Shared by both furniture variants. */
const addBrandWall = (b: Batch, room: RoomGeom, count: number) => {
  const backZ = room.z + WALL_T / 2 + 0.03
  const leftX = room.x + WALL_T / 2 + 0.03
  b.at([room.x + room.w * 0.55, 1.55, backZ + 0.03], [0, 0, 0], () => addMoodBoardFrame(b, count))
  b.at([leftX + 0.03, 1.45, room.z + room.d * 0.42], [0, Math.PI / 2, 0], () =>
    addWhiteboardFrame(b),
  )
}

type Station = { x: number; z: number; facing: number; roleKey: string }

/**
 * Variant B of the furniture trial: authored CC0 pieces (KayKit Furniture Bits) in place of the
 * procedural desks, chairs, shelf, plants and lamps. Monitors, keyboards and the brand wall stay
 * procedural because the pack has no office electronics; that mix is the hybrid pipeline itself.
 */
function AuthoredFurniture({
  room,
  stations,
  batchKey,
  wallCount,
}: {
  room: RoomGeom
  stations: Station[]
  batchKey: string
  wallCount: number
}) {
  const names: KayKitModel[] = [
    'table_medium',
    'chair_B',
    'shelf_B_large_decorated',
    'cabinet_small',
    'lamp_table',
    'lamp_standing',
    'cactus_medium_A',
    'cactus_small_A',
    'book_set',
    'book_single',
    'pictureframe_medium',
    'pictureframe_standing_A',
    'rug_rectangle_A',
    'armchair',
    'table_low',
    'pillow_A',
  ]
  const models = useGLTF(names.map(kaykitUrl)) as unknown as { scene: THREE.Group }[]
  const m = (n: KayKitModel) => models[names.indexOf(n)]!
  const leftX = room.x + WALL_T / 2 + 0.03
  return (
    <Batched
      deps={[batchKey, 'glb']}
      build={(b) => {
        addBrandWall(b, room, wallCount)
        addKayKit(
          b,
          m('shelf_B_large_decorated'),
          [leftX + 0.22, 1.35, room.z + room.d * 0.78],
          Math.PI / 2,
        )
        addKayKit(b, m('cabinet_small'), [leftX + 0.4, 0, room.z + room.d * 0.78], Math.PI / 2)
        addKayKit(
          b,
          m('book_set'),
          [leftX + 0.4, 0.75 + 0.19, room.z + room.d * 0.78],
          Math.PI / 2 + 0.2,
          0.6,
        )
        addKayKit(b, m('lamp_standing'), [room.x + 0.55, 0, room.z + 0.55], 0)
        addKayKit(b, m('cactus_medium_A'), [room.x + room.w - 0.65, 0, room.z + 0.6], 0.4)
        b.push([room.x + room.w - 1.2, 0, room.z + room.d - 1.3], [0, -2.4, 0])
        addKayKit(b, m('armchair'), [0, 0, 0], 0, 0.7)
        addKayKit(b, m('pillow_A'), [0.15, 0.42, 0.05], 0.3, 0.7)
        addKayKit(b, m('table_low'), [0, 0, 1.25], 0, 0.6)
        addKayKit(b, m('cactus_small_A'), [-0.35, 0.3, 1.25], 0, 0.55)
        addKayKit(b, m('pictureframe_standing_A'), [0.4, 0.3, 1.2], -0.5, 0.55)
        b.pop()
        const mid = stations.length
          ? {
              x: stations.reduce((a, s) => a + s.x, 0) / stations.length,
              z: stations.reduce((a, s) => a + s.z, 0) / stations.length,
            }
          : { x: room.cx, z: room.cz }
        addKayKit(b, m('rug_rectangle_A'), [mid.x, 0, mid.z + 0.3], Math.PI / 2, [1.5, 0.35, 1.4])
        for (const s of stations) {
          const look = LOOKS[s.roleKey] ?? LOOKS['managing-director']!
          const side = look.hairStyle === 'bun' ? -1 : 1
          b.push([s.x, 0, s.z], [0, s.facing, 0])
          addKayKit(b, m('table_medium'), [0, 0, 0], 0, [0.7, 0.74, 0.4])
          addMonitorBody(b)
          addKeyboard(b)
          addKayKit(b, m('lamp_table'), [side * 0.56, 0.74, -0.22], 0, 0.3)
          if (look.hairStyle === 'bun') {
            addHeadphones(b)
            addMug(b, '#dfe8e3', -0.45)
          } else {
            addMug(b, '#1a1c1f')
            addKayKit(b, m('book_single'), [-0.45, 0.74 + 0.1, 0.18], 0.3, 0.4)
          }
          addPcBox(b)
          addKayKit(b, m('chair_B'), [0, 0, 0.74], Math.PI, 0.75)
          addPendantBody(b, 2.8, 1.0)
          b.pop()
        }
      }}
    />
  )
}

/** The live half of a workstation: screen, lamp light, LED, the person, and the hit volume that selects them. */
function Workstation({
  agent,
  x,
  z,
  facing,
}: {
  agent: AgentRow
  x: number
  z: number
  facing: number
}) {
  const select = useHq((s) => s.select)
  const selection = useHq((s) => s.selection)
  const [hovered, setHovered] = useState(false)
  const selected = selection?.kind === 'agent' && selection.id === agent.id
  const look = LOOKS[agent.roleKey] ?? LOOKS['managing-director']!
  const active = agent.state === 'working' || agent.state === 'reviewing'
  const content = useMemo(
    () => ({
      title: agent.currentTask?.title ?? '',
      state: agent.state,
      kind: agent.currentTask?.kind ?? '',
      lines: agent.currentTask
        ? [
            `Status: ${agent.currentTask.status}`,
            '',
            agent.state === 'working'
              ? 'Writing…'
              : agent.state === 'reviewing'
                ? 'Checking every claim against its row…'
                : '',
          ]
        : [],
      simulated: true,
    }),
    [agent.currentTask, agent.state],
  )
  const seated = agent.state !== 'meeting'
  return (
    <group position={[x, 0, z]} rotation={[0, facing, 0]}>
      <mesh
        position={[0, 0.8, 0.25]}
        visible={false}
        onClick={(e) => {
          if (e.delta > 6) return
          e.stopPropagation()
          select({ kind: 'agent', id: agent.id })
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = 'auto'
        }}
      >
        <boxGeometry args={[1.5, 1.7, 1.6]} />
      </mesh>
      <MonitorScreen
        content={content}
        brightness={active ? 1 : agent.state === 'blocked' ? 0.45 : 0.25}
      />
      <LampLight
        intensity={agent.state === 'working' ? 1.3 : agent.state === 'reviewing' ? 1.0 : 0.55}
        side={look.hairStyle === 'bun' ? -1 : 1}
      />
      <StatusLed active={active} blocked={agent.state === 'blocked'} />
      <PendantLight drop={1.0} intensity={1.4} />
      <group position={[0, 0, 0.78]} rotation={[0, Math.PI, 0]}>
        {flag('writers') || !RIGGED_LOOKS[agent.roleKey] ? (
          <Writer
            look={look}
            state={agent.state}
            seated={seated}
            selected={selected}
            hovered={hovered}
          />
        ) : (
          <Suspense fallback={null}>
            <RiggedWriter
              look={RIGGED_LOOKS[agent.roleKey]!}
              state={agent.state}
              seated={seated}
              selected={selected}
              hovered={hovered}
            />
          </Suspense>
        )}
      </group>
      {(hovered || selected) && !flag('notext') && (
        <Billboard position={[0, 1.72, 0.78]} follow>
          <Text
            fontSize={0.065}
            color="#faf8f4"
            anchorX="center"
            anchorY="bottom"
            outlineWidth={0.004}
            outlineColor="#0e0f11"
          >
            {agent.name}
          </Text>
          <Text
            position={[0, -0.015, 0]}
            fontSize={0.048}
            color={agent.state === 'blocked' ? PALETTE.pink : active ? PALETTE.warm : '#9a9ca1'}
            anchorX="center"
            anchorY="top"
            outlineWidth={0.003}
            outlineColor="#0e0f11"
          >
            {agent.state}
          </Text>
        </Billboard>
      )}
    </group>
  )
}

'use client'
import { Billboard, Text } from '@react-three/drei'
import type { Snapshot } from '@vigoros/ops'
import { Suspense, useMemo, useState } from 'react'
import * as THREE from 'three'
import { flag } from '@/lib/flags'
import type { RoomGeom } from '@/lib/layout'
import { useHq } from '@/lib/store'
import { useGLTF } from '@react-three/drei'
import { type Batch } from './batch'
import { Batched } from './Batched'
import { addKayKit, kaykitUrl, type KayKitModel } from './KayKit'
import { RIGGED_LOOKS, RiggedWriter } from './RiggedWriter'
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
import { PALETTE } from './materials'
import { LOOKS, Writer } from './Writer'

type AgentRow = Snapshot['agents'][number]

const MOOD = [
  '/moodboard/front.jpg',
  '/moodboard/test4-paris-realworld.jpg',
  '/moodboard/judging.jpg',
  '/moodboard/tiny-ceo.jpg',
  '/moodboard/hero.jpg',
  '/moodboard/sunglasses.jpg',
]

/** World position of a writer's workstation. Exported so the camera can frame the person. */
export const writerStation = (
  room: RoomGeom,
  roleKey: string,
): { x: number; z: number; facing: number } => {
  const cx = room.x + room.w * 0.52
  const cz = room.z + room.d * 0.55
  // A sits on the west side looking east across the shared desk; B mirrors her. Local +z is the person's side.
  return roleKey === 'comedy-writer-a'
    ? { x: cx - 1.0, z: cz, facing: -Math.PI / 2 }
    : { x: cx + 1.0, z: cz, facing: Math.PI / 2 }
}

const chairColor = new THREE.Color(PALETTE.accents['creative'] ?? '#e3a53a')
  .multiplyScalar(0.7)
  .getStyle()

/**
 * The vertical slice: two complete workstations with Writer A and Writer B, the mood board, the
 * whiteboard with the current brief, a bookshelf, plants, pendants. Everything an agent does here
 * comes from the snapshot row; nothing animates work without a run. All static furniture is one
 * batch; the live parts (screens, lamps, LEDs, the people) sit over it.
 */
export function WritersRoom({
  room,
  agents,
  briefTitle,
  briefLines,
}: {
  room: RoomGeom
  agents: AgentRow[]
  briefTitle: string
  briefLines: string[]
}) {
  const writers = agents.filter(
    (a) => a.roleKey === 'comedy-writer-a' || a.roleKey === 'comedy-writer-b',
  )
  const backZ = room.z + WALL_T / 2 + 0.03
  const leftX = room.x + WALL_T / 2 + 0.03
  const stations = writers.map((a) => ({ agent: a, ...writerStation(room, a.roleKey) }))
  const key = `${room.id}:${room.x},${room.z},${room.w},${room.d}:${stations.map((s) => s.agent.roleKey).join(',')}`
  const glb = flag('furniture')
  const stationList = stations.map((s) => ({
    x: s.x,
    z: s.z,
    facing: s.facing,
    roleKey: s.agent.roleKey,
  }))
  return (
    <group>
      {glb ? (
        <Suspense fallback={null}>
          <AuthoredFurniture room={room} stations={stationList} batchKey={key} />
        </Suspense>
      ) : (
        <Batched
          deps={[key]}
          build={(b) => {
            addCreativeWall(b, room)
            b.at([leftX + 0.17, 0, room.z + room.d * 0.78], [0, Math.PI / 2, 0], () =>
              addBookshelf(b, 1.3, room.key),
            )
            b.at([room.x + 0.5, 0, room.z + 0.5], [0, 0, 0], () => addPlant(b, 1.2))
            b.at([room.x + room.w - 0.6, 0, room.z + room.d - 0.6], [0, 0, 0], () =>
              addPlant(b, 0.9),
            )
            for (const s of stationList) {
              const look = LOOKS[s.roleKey] ?? LOOKS['comedy-writer-a']!
              b.push([s.x, 0, s.z], [0, s.facing, 0])
              addDesk(b)
              addMonitorBody(b)
              addKeyboard(b)
              addLampBody(b, look.hairStyle === 'bun' ? -1 : 1)
              if (look.hairStyle === 'bun') {
                addHeadphones(b)
                addMug(b, '#dfe8e3', -0.45)
              } else {
                addMug(b, '#2a2b31')
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
        <MoodBoardPhotos images={MOOD} />
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
          color="#f4f1ea"
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.2}
          outlineWidth={0.003}
          outlineColor={PALETTE.pink}
        >
          BUNNI · MOOD BOARD
        </Text>
      )}
    </group>
  )
}

/** Bunni's creative wall: the mood board frame and the whiteboard frame. Shared by both furniture variants. */
const addCreativeWall = (b: Batch, room: RoomGeom) => {
  const backZ = room.z + WALL_T / 2 + 0.03
  const leftX = room.x + WALL_T / 2 + 0.03
  b.at([room.x + room.w * 0.55, 1.55, backZ + 0.03], [0, 0, 0], () =>
    addMoodBoardFrame(b, MOOD.length),
  )
  b.at([leftX + 0.03, 1.45, room.z + room.d * 0.42], [0, Math.PI / 2, 0], () =>
    addWhiteboardFrame(b),
  )
}

type Station = { x: number; z: number; facing: number; roleKey: string }

/**
 * Variant B of the furniture trial: authored CC0 pieces (KayKit Furniture Bits) in place of the
 * procedural desks, chairs, shelf, plants and lamps. Monitors, keyboards and the creative wall stay
 * procedural because the pack has no office electronics; that mix is the hybrid pipeline itself.
 */
function AuthoredFurniture({
  room,
  stations,
  batchKey,
}: {
  room: RoomGeom
  stations: Station[]
  batchKey: string
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
        addCreativeWall(b, room)
        // left wall: a wall shelf with books over a low cabinet, a standing lamp in the far corner
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
        // a reading corner by the glass: armchair, low table, a small cactus and a standing frame
        b.push([room.x + room.w - 1.2, 0, room.z + room.d - 1.3], [0, -2.4, 0])
        addKayKit(b, m('armchair'), [0, 0, 0], 0, 0.7)
        addKayKit(b, m('pillow_A'), [0.15, 0.42, 0.05], 0.3, 0.7)
        addKayKit(b, m('table_low'), [0, 0, 1.25], 0, 0.6)
        addKayKit(b, m('cactus_small_A'), [-0.35, 0.3, 1.25], 0, 0.55)
        addKayKit(b, m('pictureframe_standing_A'), [0.4, 0.3, 1.2], -0.5, 0.55)
        b.pop()
        // the writers' shared rug
        const mid = stations.length
          ? {
              x: stations.reduce((a, s) => a + s.x, 0) / stations.length,
              z: stations.reduce((a, s) => a + s.z, 0) / stations.length,
            }
          : { x: room.cx, z: room.cz }
        addKayKit(b, m('rug_rectangle_A'), [mid.x, 0, mid.z + 0.3], Math.PI / 2, [1.5, 0.35, 1.4])
        for (const s of stations) {
          const look = LOOKS[s.roleKey] ?? LOOKS['comedy-writer-a']!
          const side = look.hairStyle === 'bun' ? -1 : 1
          b.push([s.x, 0, s.z], [0, s.facing, 0])
          // a 2 by 2 unit table squeezed to desk proportions: 1.4 wide, 0.74 high, 0.8 deep
          addKayKit(b, m('table_medium'), [0, 0, 0], 0, [0.7, 0.74, 0.4])
          addMonitorBody(b)
          addKeyboard(b)
          addKayKit(b, m('lamp_table'), [side * 0.56, 0.74, -0.22], 0, 0.3)
          if (look.hairStyle === 'bun') {
            addHeadphones(b)
            addMug(b, '#dfe8e3', -0.45)
          } else {
            addMug(b, '#2a2b31')
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

/** The live half of a workstation: screen, lamp light, LED, the writer, and the hit volume that selects them. */
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
  const look = LOOKS[agent.roleKey] ?? LOOKS['comedy-writer-a']!
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
              ? 'Writing the draft…'
              : agent.state === 'reviewing'
                ? 'Reading the brief and the rules…'
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
      {/* one invisible volume answers every click and hover for the whole workstation */}
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
            color="#f4f1ea"
            anchorX="center"
            anchorY="bottom"
            outlineWidth={0.004}
            outlineColor="#08080a"
          >
            {agent.name}
          </Text>
          <Text
            position={[0, -0.015, 0]}
            fontSize={0.048}
            color={agent.state === 'blocked' ? PALETTE.pink : active ? PALETTE.warm : '#b4b4bc'}
            anchorX="center"
            anchorY="top"
            outlineWidth={0.003}
            outlineColor="#08080a"
          >
            {agent.state}
          </Text>
        </Billboard>
      )}
    </group>
  )
}

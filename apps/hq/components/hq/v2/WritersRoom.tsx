'use client'
import { Billboard, Text } from '@react-three/drei'
import type { Snapshot } from '@vigoros/ops'
import { useMemo, useState } from 'react'
import * as THREE from 'three'
import { flag } from '@/lib/flags'
import type { RoomGeom } from '@/lib/layout'
import { useHq } from '@/lib/store'
import {
  Bookshelf,
  Chair,
  Desk,
  DeskLamp,
  Headphones,
  Keyboard,
  Monitor,
  MoodBoard,
  Mug,
  Notebook,
  Pendant,
  Plant,
  Whiteboard,
} from './Furniture'
import { PALETTE } from './materials'
import { LOOKS, Writer } from './Writer'
import { WALL_T } from './BuildingV2'

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

/**
 * The vertical slice: two complete workstations with Writer A and Writer B, the mood board, the
 * whiteboard with the current brief, a bookshelf, plants, pendants. Everything an agent does here
 * comes from the snapshot row; nothing animates work without a run.
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
  return (
    <group>
      {/* mood board on the back wall, whiteboard and shelf on the left wall */}
      <group position={[room.x + room.w * 0.55, 1.55, backZ + 0.03]}>
        <MoodBoard images={MOOD} />
      </group>
      <group position={[leftX + 0.03, 1.45, room.z + room.d * 0.42]} rotation={[0, Math.PI / 2, 0]}>
        <Whiteboard title={briefTitle} lines={briefLines} />
      </group>
      <group position={[leftX + 0.17, 0, room.z + room.d * 0.78]} rotation={[0, Math.PI / 2, 0]}>
        <Bookshelf width={1.3} accent={room.key} />
      </group>
      <group position={[room.x + 0.5, 0, room.z + 0.5]}>
        <Plant scale={1.2} />
      </group>
      <group position={[room.x + room.w - 0.6, 0, room.z + room.d - 0.6]}>
        <Plant scale={0.9} />
      </group>
      {writers.map((a) => {
        const s = writerStation(room, a.roleKey)
        return <Workstation key={a.id} agent={a} x={s.x} z={s.z} facing={s.facing} />
      })}
      {writers.map((a) => {
        const s = writerStation(room, a.roleKey)
        return (
          <group key={`p${a.id}`} position={[s.x, 0, s.z]}>
            <Pendant drop={1.0} intensity={1.4} />
          </group>
        )
      })}
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

/** Desk, chair, monitor, keyboard, lamp and personal objects, with the writer seated behind it. */
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
  const chairColor = useMemo(
    () => new THREE.Color(PALETTE.accents['creative'] ?? '#e3a53a').multiplyScalar(0.7).getStyle(),
    [],
  )
  return (
    <group
      position={[x, 0, z]}
      rotation={[0, facing, 0]}
      onClick={(e) => {
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
      <Desk>
        <Monitor
          content={content}
          brightness={active ? 1 : agent.state === 'blocked' ? 0.45 : 0.25}
        />
        <Keyboard />
        <DeskLamp
          intensity={agent.state === 'working' ? 1.3 : agent.state === 'reviewing' ? 1.0 : 0.55}
          side={look.hairStyle === 'bun' ? -1 : 1}
        />
        {look.hairStyle === 'bun' ? (
          <>
            <Headphones />
            <Mug color="#dfe8e3" x={-0.45} />
          </>
        ) : (
          <>
            <Mug color="#2a2b31" />
            <Notebook />
          </>
        )}
        {/* a small PC under the desk with a status LED that only lights with a run */}
        <mesh position={[-0.5, 0.2, -0.15]} castShadow>
          <boxGeometry args={[0.16, 0.38, 0.4]} />
          <meshStandardMaterial color="#1e1f24" roughness={0.5} metalness={0.3} />
        </mesh>
        <mesh position={[-0.5, 0.36, 0.06]}>
          <sphereGeometry args={[0.012, 8, 8]} />
          <meshStandardMaterial
            color="#000"
            emissive={agent.state === 'blocked' ? PALETTE.pink : PALETTE.warm}
            emissiveIntensity={active ? 2.5 : agent.state === 'blocked' ? 2.5 : 0.15}
          />
        </mesh>
      </Desk>
      <group position={[0, 0, 0.72]}>
        <Chair color={chairColor} rotation={Math.PI} />
      </group>
      <group position={[0, 0, 0.78]} rotation={[0, Math.PI, 0]}>
        <Writer
          look={look}
          state={agent.state}
          seated={seated}
          selected={selected}
          hovered={hovered}
        />
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

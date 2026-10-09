'use client'
import { Billboard, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import type { Snapshot } from '@vigoros/ops'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { DEPARTMENT_TINT, STATE_LABEL } from '@/lib/layout'
import { flag } from '@/lib/flags'
import { useHq } from '@/lib/store'

const WARM = '#ffd9a8'
const PINK = '#f28bb5'

type AgentRow = Snapshot['agents'][number]

/**
 * A capsule employee. Every visible state is read from the snapshot row: screen on means a run is
 * open, pink marker means blocked, walking to the boardroom means an open meeting. The bob is
 * cosmetic and only plays while the row says working.
 */
export function Avatar({
  agent,
  departmentKey,
  home,
  seat,
}: {
  agent: AgentRow
  departmentKey: string
  home: { x: number; z: number }
  seat: { x: number; z: number } | null
}) {
  const group = useRef<THREE.Group>(null)
  const body = useRef<THREE.MeshStandardMaterial>(null)
  const screen = useRef<THREE.MeshStandardMaterial>(null)
  const select = useHq((s) => s.select)
  const setFocus = useHq((s) => s.setFocus)
  const selected = useHq((s) => s.selection)
  const isSelected = selected?.kind === 'agent' && selected.id === agent.id
  const tint = DEPARTMENT_TINT[departmentKey] ?? WARM
  const colour = useMemo(() => new THREE.Color(tint), [tint])
  const active = agent.state === 'working' || agent.state === 'reviewing'
  const target = agent.state === 'meeting' && seat ? seat : home

  useFrame(({ clock }, dt) => {
    const g = group.current
    if (!g) return
    const k = 1 - Math.exp(-dt * 3)
    g.position.x += (target.x - g.position.x) * k
    g.position.z += (target.z - g.position.z) * k
    const bob = active ? Math.sin(clock.elapsedTime * 4 + g.position.x) * 0.03 : 0
    g.position.y += (bob - g.position.y) * k
    if (body.current) {
      const dim = agent.state === 'idle' ? 0.62 : agent.state === 'waiting' ? 0.8 : 1
      body.current.color.lerp(colour.clone().multiplyScalar(dim), k)
      body.current.emissive.lerp(
        isSelected ? new THREE.Color(WARM).multiplyScalar(0.35) : new THREE.Color('#000000'),
        k,
      )
    }
    if (screen.current) {
      const want = active
        ? agent.state === 'reviewing'
          ? 1.2 + Math.sin(clock.elapsedTime * 1.5) * 0.3
          : 1.8
        : 0.05
      screen.current.emissiveIntensity += (want - screen.current.emissiveIntensity) * k
    }
  })

  return (
    <group
      ref={group}
      position={[home.x, 0, home.z]}
      onClick={(e) => {
        e.stopPropagation()
        select({ kind: 'agent', id: agent.id })
        setFocus({ x: home.x, z: home.z, zoom: 2.2 })
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = 'auto')}
    >
      {/* Chair side of the desk: the avatar sits just behind it. */}
      <group position={[0, 0, 0.62]}>
        <mesh position={[0, 0.42, 0]} castShadow>
          <capsuleGeometry args={[0.18, 0.42, 6, 12]} />
          <meshStandardMaterial ref={body} color={tint} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.86, 0]} castShadow>
          <sphereGeometry args={[0.17, 16, 16]} />
          <meshStandardMaterial color="#efe6dc" roughness={0.8} />
        </mesh>
        {agent.state === 'blocked' && (
          <mesh position={[0, 1.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.14, 0.035, 8, 24]} />
            <meshStandardMaterial color={PINK} emissive={PINK} emissiveIntensity={1.6} />
          </mesh>
        )}
      </group>
      {/* The screen on the desk in front of the avatar. */}
      <mesh position={[0, 0.62, -0.1]} rotation={[-0.25, 0, 0]}>
        <boxGeometry args={[0.46, 0.3, 0.03]} />
        <meshStandardMaterial
          ref={screen}
          color="#101014"
          emissive={WARM}
          emissiveIntensity={0.05}
        />
      </mesh>
      {!flag('nohtml') && (
        <Billboard position={[0, 1.45, 0.6]} follow>
          <Text
            fontSize={0.2}
            color={isSelected ? WARM : '#f2f2f4'}
            anchorX="center"
            anchorY="bottom"
            outlineWidth={0.012}
            outlineColor="#08080a"
          >
            {agent.name}
          </Text>
          <Text
            position={[0, -0.04, 0]}
            fontSize={0.13}
            color={agent.state === 'blocked' ? PINK : active ? WARM : '#9a9aa2'}
            anchorX="center"
            anchorY="top"
            outlineWidth={0.01}
            outlineColor="#08080a"
          >
            {STATE_LABEL[agent.state] ?? agent.state}
          </Text>
        </Billboard>
      )}
    </group>
  )
}

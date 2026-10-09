'use client'
import { useFrame } from '@react-three/fiber'
import type { AgentState } from '@vigoros/contracts'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { M, PALETTE, roundedBox } from './materials'

/**
 * A stylised person: five and a half heads, soft shapes, one defining colour. Parametric rig
 * (hips, torso, head, arms, legs) animated from the agent's real state. Idle is breathing and
 * glances only; typing, leaning and the chin-hand only happen on states that mean a run exists.
 */
export interface Look {
  skin: string
  hair: string
  hairStyle: 'short-part' | 'bun'
  top: string
  trousers: string
  shoes: string
  glasses: boolean
  build: number
}

export const LOOKS: Record<string, Look> = {
  'comedy-writer-a': {
    skin: '#c69b7b',
    hair: '#2a2420',
    hairStyle: 'short-part',
    top: '#e3a53a',
    trousers: '#2f3340',
    shoes: '#f2f0ea',
    glasses: true,
    build: 0.94,
  },
  'comedy-writer-b': {
    skin: '#e8c3a6',
    hair: '#8a4a2c',
    hairStyle: 'bun',
    top: '#3f8f8a',
    trousers: '#5a5f3e',
    shoes: '#3a2e26',
    glasses: false,
    build: 1.06,
  },
}

const damp = (cur: number, to: number, dt: number, k = 6) =>
  cur + (to - cur) * (1 - Math.exp(-dt * k))

export function Writer({
  look,
  state,
  seated,
  selected,
  hovered,
  lookAt,
}: {
  look: Look
  state: AgentState
  seated: boolean
  selected: boolean
  hovered: boolean
  lookAt?: THREE.Vector3 | null
}) {
  const hips = useRef<THREE.Group>(null)
  const torso = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const foreL = useRef<THREE.Group>(null)
  const foreR = useRef<THREE.Group>(null)
  const legL = useRef<THREE.Group>(null)
  const legR = useRef<THREE.Group>(null)
  const shinL = useRef<THREE.Group>(null)
  const shinR = useRef<THREE.Group>(null)
  const outline = useRef<THREE.MeshStandardMaterial>(null)
  const phase = useMemo(() => Math.random() * 10, [])
  const b = look.build

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime + phase
    const working = state === 'working'
    const reviewing = state === 'reviewing'
    const blocked = state === 'blocked'
    // Base pose
    const hipY = seated ? 0.5 : 0.92
    const thigh = seated ? -Math.PI / 2 : 0
    const shin = seated ? Math.PI / 2 : 0
    // Torso: lean in while typing, back while reviewing, breathing always
    const lean = working
      ? 0.16
      : reviewing
        ? -0.14
        : blocked
          ? 0.05
          : -0.04 + Math.sin(t * 0.25) * 0.02
    const breathe = 1 + Math.sin(t * 1.9) * 0.012
    // Arms: at the keyboard when working, chin when reviewing, open when blocked, resting otherwise
    const upper = working ? -0.95 : reviewing ? -0.6 : blocked ? -0.5 : seated ? -0.55 : 0.05
    const fore = working ? -0.9 : reviewing ? -1.9 : blocked ? -1.1 : seated ? -1.0 : 0
    const typeL = working ? Math.sin(t * 11) * 0.06 : 0
    const typeR = working ? Math.sin(t * 11 + 1.7) * 0.06 : 0
    const tapR =
      !working && !reviewing && look.hairStyle === 'bun' && seated
        ? Math.max(0, Math.sin(t * 2.2)) * 0.08
        : 0
    // Head: at the screen while working, slow glances when idle, to the camera when blocked
    const yaw = working
      ? Math.sin(t * 0.7) * 0.04
      : blocked
        ? 0
        : Math.sin(t * 0.33) * 0.35 + Math.sin(t * 0.11) * 0.2
    const pitch = working ? 0.12 : reviewing ? -0.08 : 0.02
    if (hips.current) hips.current.position.y = damp(hips.current.position.y, hipY, dt)
    if (torso.current) {
      torso.current.rotation.x = damp(torso.current.rotation.x, lean, dt)
      torso.current.scale.y = breathe
    }
    if (head.current) {
      head.current.rotation.y = damp(head.current.rotation.y, yaw, dt, 3)
      head.current.rotation.x = damp(head.current.rotation.x, pitch, dt, 3)
    }
    if (armL.current) armL.current.rotation.x = damp(armL.current.rotation.x, upper + typeL, dt)
    if (armR.current)
      armR.current.rotation.x = damp(
        armR.current.rotation.x,
        (reviewing ? upper - 0.5 : upper) + typeR - tapR,
        dt,
      )
    if (foreL.current) foreL.current.rotation.x = damp(foreL.current.rotation.x, fore, dt)
    if (foreR.current)
      foreR.current.rotation.x = damp(foreR.current.rotation.x, reviewing ? fore - 0.2 : fore, dt)
    for (const r of [legL, legR])
      if (r.current) r.current.rotation.x = damp(r.current.rotation.x, thigh, dt)
    for (const r of [shinL, shinR])
      if (r.current) r.current.rotation.x = damp(r.current.rotation.x, shin, dt)
    if (outline.current)
      outline.current.emissiveIntensity = damp(
        outline.current.emissiveIntensity,
        selected ? 0.9 : hovered ? 0.35 : 0,
        dt,
        8,
      )
    void lookAt
  })

  const skin = M.skin(look.skin)
  const top = M.fabric(look.top)
  const trousers = M.fabric(look.trousers)
  const hair = M.hair(look.hair)

  return (
    <group scale={[b, 1, b]}>
      <group ref={hips} position={[0, 0.5, 0]}>
        {/* hips */}
        <mesh
          geometry={roundedBox(0.34, 0.2, 0.22, 0.06)}
          material={trousers}
          position={[0, 0, 0]}
          castShadow
        />
        {/* legs */}
        {[-0.1, 0.1].map((x, i) => (
          <group key={x} ref={i === 0 ? legL : legR} position={[x, -0.06, 0]}>
            <mesh material={trousers} position={[0, -0.2, 0]} castShadow>
              <capsuleGeometry args={[0.075, 0.3, 6, 12]} />
            </mesh>
            <group ref={i === 0 ? shinL : shinR} position={[0, -0.42, 0]}>
              <mesh material={trousers} position={[0, -0.19, 0]} castShadow>
                <capsuleGeometry args={[0.062, 0.28, 6, 12]} />
              </mesh>
              <mesh
                geometry={roundedBox(0.11, 0.07, 0.26, 0.03)}
                material={M.plastic(look.shoes)}
                position={[0, -0.4, 0.06]}
                castShadow
              />
            </group>
          </group>
        ))}
        {/* torso */}
        <group ref={torso} position={[0, 0.08, 0]}>
          <mesh
            geometry={roundedBox(0.4, 0.5, 0.24, 0.09)}
            material={top}
            position={[0, 0.27, 0]}
            castShadow
          />
          {/* collar */}
          <mesh position={[0, 0.52, 0.01]}>
            <torusGeometry args={[0.085, 0.02, 8, 20]} />
            <primitive object={top} attach="material" />
          </mesh>
          {/* arms */}
          {[-0.235, 0.235].map((x, i) => (
            <group key={x} ref={i === 0 ? armL : armR} position={[x, 0.46, 0]}>
              <mesh material={top} position={[0, -0.15, 0]} castShadow>
                <capsuleGeometry args={[0.058, 0.22, 6, 12]} />
              </mesh>
              <group ref={i === 0 ? foreL : foreR} position={[0, -0.3, 0]}>
                <mesh material={top} position={[0, -0.13, 0]} castShadow>
                  <capsuleGeometry args={[0.05, 0.18, 6, 12]} />
                </mesh>
                <mesh material={skin} position={[0, -0.29, 0]} castShadow>
                  <sphereGeometry args={[0.055, 12, 10]} />
                </mesh>
              </group>
            </group>
          ))}
          {/* neck and head */}
          <mesh material={skin} position={[0, 0.56, 0]}>
            <cylinderGeometry args={[0.055, 0.065, 0.08, 12]} />
          </mesh>
          <group ref={head} position={[0, 0.72, 0]}>
            <mesh material={skin} scale={[1, 1.1, 1]} castShadow>
              <sphereGeometry args={[0.155, 24, 20]} />
            </mesh>
            {/* hair */}
            {look.hairStyle === 'short-part' ? (
              <mesh material={hair} position={[0, 0.075, -0.025]} scale={[1.04, 0.9, 1.04]}>
                <sphereGeometry args={[0.16, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.48]} />
              </mesh>
            ) : (
              <>
                <mesh material={hair} position={[0, 0.07, -0.02]} scale={[1.05, 0.95, 1.05]}>
                  <sphereGeometry args={[0.16, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
                </mesh>
                <mesh material={hair} position={[0, 0.12, -0.13]} castShadow>
                  <sphereGeometry args={[0.075, 16, 12]} />
                </mesh>
              </>
            )}
            {/* face */}
            {[-0.055, 0.055].map((x) => (
              <group key={x} position={[x, 0.01, 0.138]}>
                <mesh>
                  <sphereGeometry args={[0.03, 12, 10]} />
                  <meshStandardMaterial color="#f8f6f2" roughness={0.3} />
                </mesh>
                <mesh position={[0, 0, 0.022]}>
                  <sphereGeometry args={[0.014, 10, 8]} />
                  <meshStandardMaterial color="#2a2420" roughness={0.3} />
                </mesh>
                <mesh
                  geometry={roundedBox(0.06, 0.012, 0.01, 0.004)}
                  material={hair}
                  position={[0, 0.045, 0.005]}
                  rotation={[0.2, 0, x < 0 ? 0.12 : -0.12]}
                />
              </group>
            ))}
            <mesh geometry={roundedBox(0.05, 0.008, 0.01, 0.003)} position={[0, -0.065, 0.15]}>
              <meshStandardMaterial color="#8a5a52" roughness={0.6} />
            </mesh>
            <mesh material={skin} position={[0, -0.02, 0.158]}>
              <sphereGeometry args={[0.02, 10, 8]} />
            </mesh>
            {look.glasses && (
              <group position={[0, 0.01, 0.15]}>
                {[-0.055, 0.055].map((x) => (
                  <mesh key={x} position={[x, 0, 0]}>
                    <torusGeometry args={[0.038, 0.005, 8, 20]} />
                    <primitive object={M.darkMetal()} attach="material" />
                  </mesh>
                ))}
                <mesh
                  geometry={roundedBox(0.03, 0.005, 0.005, 0.002)}
                  material={M.darkMetal()}
                  position={[0, 0.005, 0]}
                />
              </group>
            )}
          </group>
          {/* selection halo: a soft rim at the chest, only lit when selected or hovered */}
          <mesh position={[0, 0.27, 0]} scale={[1.06, 1.04, 1.06]}>
            <boxGeometry args={[0.4, 0.5, 0.24]} />
            <meshStandardMaterial
              ref={outline}
              color="#000"
              transparent
              opacity={0.0}
              emissive={PALETTE.warm}
              emissiveIntensity={0}
              depthWrite={false}
            />
          </mesh>
        </group>
      </group>
    </group>
  )
}

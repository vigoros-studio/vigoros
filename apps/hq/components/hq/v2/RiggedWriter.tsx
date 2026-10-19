'use client'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import type { AgentState } from '@vigoros/contracts'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { PALETTE } from './materials'

/**
 * A rigged employee from an authored, CC0 base (Quaternius Ultimate Modular packs, see
 * docs/assets/REGISTER.md), restyled to the Vigoros palette by material name. The pack's Idle
 * and Walk clips drive the body; the seated pose, typing, leaning, chin-hand and head turns are
 * procedural overrides on named bones, applied after the clip each frame. Every pose comes from
 * the agent's real state: idle people breathe and glance, nobody types without an open run.
 */
export interface RiggedLook {
  model: string
  /** Material name in the file → palette colour. Unlisted materials keep the pack's colour. */
  colors: Record<string, string>
  /** Which hand rests on the desk when idle; the other taps. */
  handed: 'left' | 'right'
  scale: number
  /** Extra yaw so the model faces -z like the parametric rig; the two packs disagree on forward. */
  yaw: number
}

const MODELS = '/models/quaternius-modular'

export const RIGGED_LOOKS: Record<string, RiggedLook> = {
  'managing-director': {
    model: `${MODELS}/men_suit.glb`,
    colors: {
      Skin: '#c69b7b',
      Hair: '#2a2420',
      Eyebrows: '#2a2420',
      Suit: '#1a1c1f', // ink
      Tie: '#24405e', // Signals, deep
      White: '#faf8f4', // paper shirt
      Grey: '#4a5663', // reference grey
      Black: '#0e0f11',
      DarkBrown: '#3a3328',
    },
    handed: 'right',
    scale: 0.97,
    yaw: 0,
  },
  'content-director': {
    model: `${MODELS}/women_casual.glb`,
    colors: {
      Skin: '#e8c3a6',
      Hair_Brown: '#8a4a2c',
      Hair_Blond: '#7e4327',
      Brown: '#5a3a26',
      White: '#7fa6cf', // the top, Signals blue
      Orange: '#1a1c1f', // trousers, ink
      Grey: '#3a2e26', // shoes
    },
    handed: 'left',
    scale: 0.98,
    yaw: 0,
  },
}

for (const l of Object.values(RIGGED_LOOKS)) useGLTF.preload(l.model)

/** Seated pose numbers, in radians, tuned against the pack's rig. Exposed on window for tuning in debug builds. */
export const POSE = {
  hipsY: 0.47,
  thigh: -1.5,
  thighSpread: 0.12,
  shin: 1.45,
  footDrop: 0.42,
  footForward: 0.0,
  upperArmRest: 0.55,
  upperArmType: 0.95,
  lowerArmRest: 0.35,
  lowerArmType: 1.35,
  armIn: 0.25,
  leanWork: 0.14,
  leanReview: -0.12,
  chinUpper: 0.3,
  chinLower: 2.2,
  headTypePitch: 0.14,
}
if (typeof window !== 'undefined' && process.env['NEXT_PUBLIC_HQ_DEBUG'] === '1')
  (window as unknown as { __pose: typeof POSE }).__pose = POSE

const damp = (cur: number, to: number, dt: number, k = 6) =>
  cur + (to - cur) * (1 - Math.exp(-dt * k))

const X = new THREE.Vector3(1, 0, 0)
const Y = new THREE.Vector3(0, 1, 0)
const Z = new THREE.Vector3(0, 0, 1)

type Bones = Record<
  | 'Body'
  | 'Hips'
  | 'Abdomen'
  | 'Torso'
  | 'Chest'
  | 'Neck'
  | 'Head'
  | 'UpperArm.L'
  | 'UpperArm.R'
  | 'LowerArm.L'
  | 'LowerArm.R'
  | 'UpperLeg.L'
  | 'UpperLeg.R'
  | 'LowerLeg.L'
  | 'LowerLeg.R'
  | 'Foot.L'
  | 'Foot.R'
  | 'Root',
  THREE.Bone
>

export function RiggedWriter({
  look,
  state,
  seated,
  selected,
  hovered,
}: {
  look: RiggedLook
  state: AgentState
  seated: boolean
  selected: boolean
  hovered: boolean
}) {
  const gltf = useGLTF(look.model)
  const phase = useMemo(() => Math.random() * 10, [])
  const built = useMemo(() => {
    const scene = cloneSkeleton(gltf.scene) as THREE.Group
    const materials: THREE.MeshStandardMaterial[] = []
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      m.castShadow = true
      m.receiveShadow = true
      m.frustumCulled = false
      const src = m.material as THREE.MeshStandardMaterial
      const mat = src.clone()
      const c = look.colors[src.name]
      if (c) mat.color.set(c)
      mat.roughness = src.name.startsWith('Hair') ? 0.55 : src.name === 'Skin' ? 0.7 : 0.85
      mat.emissive = new THREE.Color(PALETTE.warm)
      mat.emissiveIntensity = 0
      m.material = mat
      materials.push(mat)
    })
    const bones = {} as Bones
    const rest = new Map<string, THREE.Quaternion>()
    scene.traverse((o) => {
      const b = o as THREE.Bone
      if (b.isBone) {
        ;(bones as Record<string, THREE.Bone>)[b.name] = b
        rest.set(b.name, b.quaternion.clone())
      }
    })
    const mixer = new THREE.AnimationMixer(scene)
    const clip = (name: string) => gltf.animations.find((a) => a.name === name)
    const idle = clip('Idle') ?? clip('Idle_Neutral')
    const walk = clip('Walk')
    const actions = {
      idle: idle ? mixer.clipAction(idle) : null,
      walk: walk ? mixer.clipAction(walk) : null,
    }
    return { scene, materials, bones, rest, mixer, actions }
  }, [gltf, look])
  // Play in an effect so a StrictMode remount restarts the clip after its cleanup stopped it.
  useEffect(() => {
    built.actions.idle?.reset().play()
    return () => {
      built.mixer.stopAllAction()
    }
  }, [built])

  const pose = useRef({ lean: 0, upperL: 0, upperR: 0, lowerL: 0, lowerR: 0, yaw: 0, pitch: 0 })
  const q = useMemo(() => new THREE.Quaternion(), [])
  const q2 = useMemo(() => new THREE.Quaternion(), [])
  const v = useMemo(() => new THREE.Vector3(), [])
  const v2 = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ clock }, dt) => {
    const { bones, rest, mixer, materials } = built
    const t = clock.elapsedTime + phase
    mixer.update(dt)
    const working = state === 'working'
    const reviewing = state === 'reviewing'
    const blocked = state === 'blocked'
    const p = pose.current
    const glow = selected ? 0.1 : hovered ? 0.05 : 0
    for (const m of materials) m.emissiveIntensity = damp(m.emissiveIntensity, glow, dt, 8)
    if (!seated || !bones.Body) return

    // Hips down onto the seat; the clip's standing height is replaced, its breathing kept.
    bones.Body.position.y = POSE.hipsY
    // Legs: thighs forward, shins down, feet planted under the knees.
    for (const side of ['L', 'R'] as const) {
      const sign = side === 'L' ? 1 : -1
      const upper = bones[`UpperLeg.${side}`]
      const lower = bones[`LowerLeg.${side}`]
      const foot = bones[`Foot.${side}`]
      if (upper && rest.get(upper.name)) {
        q.setFromAxisAngle(X, POSE.thigh).multiply(q2.setFromAxisAngle(Z, sign * POSE.thighSpread))
        upper.quaternion.copy(rest.get(upper.name)!).multiply(q)
      }
      if (lower && rest.get(lower.name))
        lower.quaternion.copy(rest.get(lower.name)!).multiply(q.setFromAxisAngle(X, POSE.shin))
      if (lower && foot && bones.Root) {
        lower.updateWorldMatrix(true, false)
        lower.getWorldPosition(v)
        v2.set(0, 1, 0).applyQuaternion(lower.getWorldQuaternion(q2)).multiplyScalar(POSE.footDrop)
        v.add(v2)
        bones.Root.worldToLocal(v)
        foot.position.set(v.x, Math.max(0.02, v.y), v.z + POSE.footForward)
      }
    }
    // Torso: lean in while typing, back while reviewing, a small sway when idle.
    const lean = working
      ? POSE.leanWork
      : reviewing
        ? POSE.leanReview
        : blocked
          ? 0.04
          : -0.03 + Math.sin(t * 0.25) * 0.02
    p.lean = damp(p.lean, lean, dt)
    // Overridden bones always start from the rest pose, never from last frame, so nothing accumulates.
    if (bones.Abdomen && rest.get('Abdomen'))
      bones.Abdomen.quaternion.copy(rest.get('Abdomen')!).multiply(q.setFromAxisAngle(X, p.lean))
    // Arms: on the keyboard when working, chin when reviewing, open when blocked, resting otherwise.
    const typeL = working ? Math.sin(t * 11) * 0.05 : 0
    const typeR = working ? Math.sin(t * 11 + 1.7) * 0.05 : 0
    const tap = !working && !reviewing ? Math.max(0, Math.sin(t * 2.2)) * 0.08 : 0
    const chinSide = look.handed === 'right' ? 'R' : 'L'
    const upperWant = (side: 'L' | 'R') =>
      reviewing && side === chinSide
        ? POSE.chinUpper
        : working
          ? POSE.upperArmType
          : blocked
            ? POSE.upperArmRest + 0.2
            : POSE.upperArmRest
    const lowerWant = (side: 'L' | 'R') =>
      reviewing && side === chinSide
        ? POSE.chinLower
        : working
          ? POSE.lowerArmType
          : blocked
            ? POSE.lowerArmRest + 0.6
            : POSE.lowerArmRest
    p.upperL = damp(p.upperL, upperWant('L') + typeL, dt)
    p.upperR = damp(p.upperR, upperWant('R') + typeR - (look.handed === 'right' ? tap : 0), dt)
    p.lowerL = damp(p.lowerL, lowerWant('L') + (look.handed === 'left' ? tap : 0), dt)
    p.lowerR = damp(p.lowerR, lowerWant('R'), dt)
    for (const side of ['L', 'R'] as const) {
      const sign = side === 'L' ? 1 : -1
      const upper = bones[`UpperArm.${side}`]
      const lower = bones[`LowerArm.${side}`]
      if (upper && rest.get(upper.name))
        upper.quaternion
          .copy(rest.get(upper.name)!)
          .multiply(q.setFromAxisAngle(X, side === 'L' ? p.upperL : p.upperR))
          .multiply(q2.setFromAxisAngle(Z, -sign * POSE.armIn))
      if (lower && rest.get(lower.name))
        lower.quaternion
          .copy(rest.get(lower.name)!)
          .multiply(q.setFromAxisAngle(X, side === 'L' ? p.lowerL : p.lowerR))
    }
    // Head: at the screen while working, slow glances when idle, straight ahead when blocked.
    const yaw = working
      ? Math.sin(t * 0.7) * 0.04
      : blocked
        ? 0
        : Math.sin(t * 0.33) * 0.35 + Math.sin(t * 0.11) * 0.2
    const pitch = working ? POSE.headTypePitch : reviewing ? -0.06 : 0.02
    p.yaw = damp(p.yaw, yaw, dt, 3)
    p.pitch = damp(p.pitch, pitch, dt, 3)
    if (bones.Head && rest.get('Head'))
      bones.Head.quaternion
        .copy(rest.get('Head')!)
        .multiply(q.setFromAxisAngle(Y, p.yaw))
        .multiply(q2.setFromAxisAngle(X, p.pitch))
  })

  return <primitive object={built.scene} scale={look.scale} rotation={[0, look.yaw, 0]} />
}

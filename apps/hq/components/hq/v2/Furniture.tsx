'use client'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { type Batch, box, capsule, cylinder, sphere, torus } from './batch'
import { M, PALETTE, roundedBox } from './materials'
import { ScreenTexture, type ScreenContent } from './ScreenTexture'

/**
 * Procedural furniture, real dimensions in metres: a desk is 1.4 by 0.7 and 0.74 high, a seat is
 * 0.45 high. Everything static is a builder that adds into a Batch, so a whole room of furniture
 * merges into a few draw calls. The parts that change with an agent's state (screens, lamp light,
 * status LEDs) are small React components placed over the batched bodies.
 */

export const addDesk = (b: Batch) => {
  b.add(roundedBox(1.4, 0.035, 0.7, 0.012), M.deskTop(), [0, 0.725, 0])
  for (const dx of [-0.62, 0.62]) {
    b.add(roundedBox(0.04, 0.7, 0.04, 0.008), M.darkMetal(), [dx, 0.35, -0.28])
    b.add(roundedBox(0.04, 0.7, 0.04, 0.008), M.darkMetal(), [dx, 0.35, 0.28])
    b.add(roundedBox(0.04, 0.03, 0.62, 0.008), M.darkMetal(), [dx, 0.02, 0])
    b.add(roundedBox(0.04, 0.03, 0.62, 0.008), M.darkMetal(), [dx, 0.69, 0])
  }
  b.add(roundedBox(1.2, 0.06, 0.12, 0.01), M.darkMetal(), [0, 0.64, -0.25])
}

export const addChair = (b: Batch, color: string, rotation = 0) => {
  b.push([0, 0, 0], [0, rotation, 0])
  b.add(roundedBox(0.46, 0.07, 0.46, 0.03), M.fabric(color), [0, 0.45, 0])
  b.add(roundedBox(0.44, 0.5, 0.06, 0.03), M.fabric(color), [0, 0.74, -0.22], [-0.12, 0, 0])
  b.add(roundedBox(0.05, 0.3, 0.05, 0.01), M.darkMetal(), [0, 0.3, 0])
  for (const deg of [0, 72, 144, 216, 288]) {
    b.push([0, 0, 0], [0, (deg * Math.PI) / 180, 0])
    b.add(roundedBox(0.3, 0.03, 0.04, 0.01), M.darkMetal(), [0.15, 0.06, 0])
    b.add(sphere(0.03, 10, 10), M.darkMetal(), [0.29, 0.03, 0])
    b.pop()
  }
  for (const dx of [-0.26, 0.26]) {
    b.add(roundedBox(0.04, 0.03, 0.26, 0.01), M.darkMetal(), [dx, 0.66, 0.02])
    b.add(roundedBox(0.03, 0.18, 0.03, 0.01), M.darkMetal(), [dx, 0.56, 0.02])
  }
  b.pop()
}

/** Stand and bezel of a 24 inch monitor. The picture is `MonitorScreen`. */
export const addMonitorBody = (b: Batch) => {
  b.push([0, 0.74, -0.12])
  b.add(roundedBox(0.22, 0.015, 0.16, 0.006), M.darkMetal(), [0, 0.008, 0])
  b.add(roundedBox(0.05, 0.14, 0.03, 0.008), M.darkMetal(), [0, 0.08, -0.02])
  b.add(roundedBox(0.56, 0.34, 0.03, 0.008), M.darkMetal(), [0, 0.31, 0], [-0.06, 0, 0])
  b.pop()
}

export const addKeyboard = (b: Batch) => {
  b.push([0, 0.745, 0.12])
  b.add(roundedBox(0.42, 0.015, 0.13, 0.006), M.plastic('#d8d5cf'))
  b.add(roundedBox(0.09, 0.012, 0.05, 0.006), M.plastic('#d8d5cf'), [0.3, 0, 0.01])
  b.pop()
}

/** Base, arm and shade of the desk lamp. The bulb and its light are `LampLight`. */
export const addLampBody = (b: Batch, side: 1 | -1) => {
  b.push([side * 0.55, 0.74, -0.2])
  b.add(roundedBox(0.12, 0.02, 0.12, 0.01), M.darkMetal(), [0, 0.01, 0])
  b.add(cylinder(0.008, 0.008, 0.4, 8), M.darkMetal(), [0, 0.2, 0], [0, 0, side * 0.25])
  b.push([-side * 0.08, 0.4, 0], [0, 0, side * 0.9])
  b.add(cylinder(0.03, 0.07, 0.1, 16, true), M.darkMetal())
  b.pop()
  b.pop()
}

export const addMug = (b: Batch, color = '#e9e4da', x = 0.45) => {
  b.push([x, 0.745, 0.2])
  b.add(cylinder(0.04, 0.035, 0.09, 16), M.plastic(color), [0, 0.045, 0])
  b.add(torus(0.022, 0.006, 8, 16), M.plastic(color), [0.045, 0.05, 0], [Math.PI / 2, 0, 0])
  b.pop()
}

export const addNotebook = (b: Batch, x = -0.42) => {
  b.push([x, 0.745, 0.18], [0, -0.2, 0])
  b.add(roundedBox(0.18, 0.015, 0.24, 0.005), M.paper())
  b.add(roundedBox(0.19, 0.004, 0.25, 0.003), M.plastic('#2f2f36'), [0, -0.009, 0])
  b.pop()
}

export const addHeadphones = (b: Batch, x = 0.3) => {
  b.push([x, 0.76, -0.3], [0.2, 0.4, 0])
  b.add(torus(0.085, 0.012, 8, 24, Math.PI), M.plastic('#2a2a30'))
  for (const dx of [-0.085, 0.085])
    b.add(cylinder(0.035, 0.035, 0.03, 16), M.plastic('#2a2a30'), [dx, 0, 0], [0, Math.PI / 2, 0])
  b.pop()
}

/** The small PC under the desk. Its status LED is `StatusLed`. */
export const addPcBox = (b: Batch) => {
  b.add(box(0.16, 0.38, 0.4), M.plastic('#1e1f24'), [-0.5, 0.2, -0.15])
}

export const addPlant = (b: Batch, scale = 1) => {
  b.push([0, 0, 0], [0, 0, 0], scale)
  b.add(cylinder(0.14, 0.11, 0.28, 20), M.pot(), [0, 0.14, 0])
  b.add(cylinder(0.125, 0.125, 0.02, 20), M.plastic('#3b2f24'), [0, 0.27, 0])
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + (i % 2) * 0.3
    const t = 0.5 + (i % 3) * 0.25
    const l = 0.26 + (i % 4) * 0.05
    b.push([0, 0.28, 0], [0, a, 0])
    b.add(sphere(0.07, 8, 6), M.leaf(), [0.08, l * 0.5, 0], [0, 0, -t])
    b.add(sphere(0.07, 10, 8), M.leaf(), [0.2, l, 0], [0.3, 0, -t - 0.5], [1, 0.35, 2.2])
    b.pop()
  }
  b.pop()
}

export const addBookshelf = (b: Batch, width: number, accent: string) => {
  const cols = ['#c9533f', '#2f5d8a', '#e3a53a', '#4f8a4a', '#7a4f8a', '#d9cfbd', '#2a2b31']
  for (const y of [0.02, 0.62, 1.22, 1.82])
    b.add(roundedBox(width, 0.03, 0.3, 0.008), M.plastic('#3a3328'), [0, y, 0])
  for (const x of [-width / 2 + 0.015, width / 2 - 0.015])
    b.add(roundedBox(0.03, 1.86, 0.3, 0.008), M.plastic('#3a3328'), [x, 0.93, 0])
  b.add(roundedBox(width, 1.86, 0.02, 0.005), M.accent(accent), [0, 0.93, -0.14])
  const shelfY = [0.035, 0.635, 1.235]
  for (let shelf = 0; shelf < 3; shelf++) {
    let x = -width / 2 + 0.06
    let i = 0
    while (x < width / 2 - 0.1) {
      const w = 0.025 + ((i * 7 + shelf * 3) % 5) * 0.008
      const h = 0.16 + ((i * 5 + shelf) % 4) * 0.02
      const c = cols[(i + shelf) % cols.length] ?? '#999'
      b.add(
        box(1, 1, 1),
        M.plastic(c),
        [x + w / 2, shelfY[shelf]! + h / 2, 0.02],
        [0, 0, 0],
        [w, h, 0.2],
      )
      x += w + 0.004
      i++
      if (i % 9 === 8) x += 0.09
    }
  }
}

export const addRug = (b: Batch, w: number, d: number, accent: string) => {
  b.add(roundedBox(w, 0.012, d, 0.006), M.rug(accent), [0, 0.006, 0], [0, 0, 0], 1, {
    castShadow: false,
  })
}

/** Cable, shade and bulb of a pendant. Its light is `PendantLight`. */
export const addPendantBody = (b: Batch, height = 2.8, drop = 0.9) => {
  b.push([0, height, 0])
  b.add(cylinder(0.004, 0.004, drop, 6), M.darkMetal(), [0, -drop / 2, 0], [0, 0, 0], 1, {
    castShadow: false,
  })
  b.add(cylinder(0.06, 0.18, 0.18, 24, true), M.shade(), [0, -drop, 0])
  b.add(sphere(0.035, 12, 12), M.bulb(), [0, -drop - 0.04, 0], [0, 0, 0], 1, {
    castShadow: false,
  })
  b.pop()
}

export const addWhiteboardFrame = (b: Batch, w = 1.6, h = 1.0) => {
  b.add(roundedBox(w + 0.06, h + 0.06, 0.03, 0.008), M.metal())
  b.add(roundedBox(w * 0.6, 0.04, 0.06, 0.01), M.metal(), [0, -h / 2 - 0.05, 0.03])
}

/** Cork, frame, paper backs and pins of the mood board; the photographs are `MoodBoardPhotos`. */
export const addMoodBoardFrame = (b: Batch, count: number, w = 2.4, h = 1.4) => {
  b.add(roundedBox(w, h, 0.04, 0.01), M.fabric('#5a4a3a'))
  b.add(roundedBox(w + 0.05, h + 0.05, 0.02, 0.008), M.plastic('#3a3328'), [0, 0, -0.012])
  for (const s of moodSlots(count, w, h)) {
    b.push([s.x, s.y, 0.03], [0, 0, s.r])
    b.add(box(0.48, 0.5, 0.006), M.paper(), [0, 0, -0.004], [0, 0, 0], 1, { castShadow: false })
    b.add(sphere(0.012, 8, 8), M.plastic(PALETTE.pink), [0, 0.24, 0.006], [0, 0, 0], 1, {
      castShadow: false,
    })
    b.pop()
  }
}

export const moodSlots = (count: number, w = 2.4, h = 1.4) => {
  const cols = 3
  return Array.from({ length: count }, (_, i) => ({
    x: -w / 2 + 0.42 + (i % cols) * ((w - 0.84) / (cols - 1)),
    y: h / 2 - 0.4 - Math.floor(i / cols) * 0.62,
    r: (((i * 37) % 9) - 4) * 0.01,
  }))
}

/* ---------- dynamic parts ---------- */

/** The monitor picture: a live canvas texture driven by the agent's task. */
export function MonitorScreen({
  content,
  brightness,
}: {
  content: ScreenContent
  brightness: number
}) {
  const screen = useMemo(() => new ScreenTexture(), [])
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: screen.texture,
        emissiveMap: screen.texture,
        emissive: new THREE.Color('#ffffff'),
        emissiveIntensity: 0.6,
        roughness: 0.35,
        color: '#000',
      }),
    [screen],
  )
  useFrame(({ clock }, dt) => {
    screen.draw(content, clock.elapsedTime)
    const want = 0.15 + brightness * 0.85
    mat.emissiveIntensity += (want - mat.emissiveIntensity) * (1 - Math.exp(-dt * 4))
  })
  return (
    <group position={[0, 0.74, -0.12]}>
      <group position={[0, 0.31, 0]} rotation={[-0.06, 0, 0]}>
        <mesh position={[0, 0.005, 0.017]} material={mat}>
          <planeGeometry args={[0.52, 0.3]} />
        </mesh>
      </group>
    </group>
  )
}

/** The desk lamp's bulb and the light it throws; its warmth is a state signal. */
export function LampLight({ intensity, side = 1 }: { intensity: number; side?: 1 | -1 }) {
  const light = useRef<THREE.PointLight>(null)
  const bulb = useRef<THREE.MeshStandardMaterial>(null)
  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt * 3)
    if (light.current) light.current.intensity += (intensity - light.current.intensity) * k
    if (bulb.current)
      bulb.current.emissiveIntensity += (intensity * 1.6 - bulb.current.emissiveIntensity) * k
  })
  return (
    <group position={[side * 0.55, 0.74, -0.2]}>
      <group position={[-side * 0.08, 0.4, 0]} rotation={[0, 0, side * 0.9]}>
        <mesh position={[0, -0.03, 0]}>
          <sphereGeometry args={[0.02, 10, 10]} />
          <meshStandardMaterial
            ref={bulb}
            color="#fff1dc"
            emissive={PALETTE.warm}
            emissiveIntensity={0.3}
          />
        </mesh>
        <pointLight
          ref={light}
          color={PALETTE.warm}
          intensity={0.3}
          distance={2.2}
          decay={2}
          position={[0, -0.05, 0]}
        />
      </group>
    </group>
  )
}

/** The PC's status LED: lit only with a run, pink when blocked. */
export function StatusLed({ active, blocked }: { active: boolean; blocked: boolean }) {
  return (
    <mesh position={[-0.5, 0.36, 0.06]}>
      <sphereGeometry args={[0.012, 8, 8]} />
      <meshStandardMaterial
        color="#000"
        emissive={blocked ? PALETTE.pink : PALETTE.warm}
        emissiveIntensity={active || blocked ? 2.5 : 0.15}
      />
    </mesh>
  )
}

export function PendantLight({
  height = 2.8,
  drop = 0.9,
  intensity = 2.4,
}: {
  height?: number
  drop?: number
  intensity?: number
}) {
  return (
    <pointLight
      position={[0, height - drop - 0.1, 0]}
      color={PALETTE.warm}
      intensity={intensity}
      distance={6}
      decay={1.8}
    />
  )
}

/** The whiteboard's writing surface, drawn once per content change. */
export function WhiteboardSurface({
  title,
  lines,
  w = 1.6,
  h = 1.0,
}: {
  title: string
  lines: string[]
  w?: number
  h?: number
}) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 1024
    c.height = 640
    const x = c.getContext('2d')!
    x.fillStyle = '#f7f7f4'
    x.fillRect(0, 0, 1024, 640)
    x.fillStyle = '#2a2b31'
    x.font = '600 44px -apple-system, Inter, system-ui, sans-serif'
    x.fillText(title.slice(0, 40), 48, 90)
    x.strokeStyle = '#e3a53a'
    x.lineWidth = 6
    x.beginPath()
    x.moveTo(48, 112)
    x.lineTo(48 + Math.min(900, x.measureText(title.slice(0, 40)).width), 112)
    x.stroke()
    x.fillStyle = '#394050'
    x.font = '30px -apple-system, Inter, system-ui, sans-serif'
    lines
      .slice(0, 11)
      .forEach((l, i) =>
        x.fillText(`${l.length > 62 ? `${l.slice(0, 61)}…` : l}`, 48, 170 + i * 42),
      )
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return t
  }, [title, lines])
  return (
    <mesh position={[0, 0, 0.018]}>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial map={tex} roughness={0.5} />
    </mesh>
  )
}

/** Pinned photographs of Bunni from her reference set, served from the app's own copies. */
export function MoodBoardPhotos({
  images,
  w = 2.4,
  h = 1.4,
}: {
  images: string[]
  w?: number
  h?: number
}) {
  const textures = useMemo(() => {
    const loader = new THREE.TextureLoader()
    return images.map((src) => {
      const t = loader.load(src)
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 4
      return t
    })
  }, [images])
  const slots = useMemo(() => moodSlots(images.length, w, h), [images.length, w, h])
  return (
    <group>
      {textures.map((t, i) => {
        const s = slots[i]
        if (!s) return null
        return (
          <mesh key={i} position={[s.x, s.y, 0.03]} rotation={[0, 0, s.r]}>
            <planeGeometry args={[0.44, 0.44]} />
            <meshStandardMaterial map={t} roughness={0.7} />
          </mesh>
        )
      })}
    </group>
  )
}

// Re-exported so callers that only need a capsule or a box for a hit volume share the cache.
export { capsule }

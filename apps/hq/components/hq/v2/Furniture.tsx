'use client'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { flag } from '@/lib/flags'
import * as THREE from 'three'
import { M, PALETTE, roundedBox } from './materials'
import { ScreenTexture, type ScreenContent } from './ScreenTexture'

/** Real dimensions in metres. A desk is 1.4 by 0.7, 0.74 high; a seat is 0.45 high. */

export function Desk({ children }: { children?: React.ReactNode }) {
  return (
    <group>
      <mesh
        geometry={roundedBox(1.4, 0.035, 0.7, 0.012)}
        material={M.deskTop()}
        position={[0, 0.725, 0]}
        castShadow
        receiveShadow
      />
      {[-0.62, 0.62].map((dx) => (
        <group key={dx} position={[dx, 0, 0]}>
          <mesh
            geometry={roundedBox(0.04, 0.7, 0.04, 0.008)}
            material={M.darkMetal()}
            position={[0, 0.35, -0.28]}
            castShadow
          />
          <mesh
            geometry={roundedBox(0.04, 0.7, 0.04, 0.008)}
            material={M.darkMetal()}
            position={[0, 0.35, 0.28]}
            castShadow
          />
          <mesh
            geometry={roundedBox(0.04, 0.03, 0.62, 0.008)}
            material={M.darkMetal()}
            position={[0, 0.02, 0]}
          />
          <mesh
            geometry={roundedBox(0.04, 0.03, 0.62, 0.008)}
            material={M.darkMetal()}
            position={[0, 0.69, 0]}
          />
        </group>
      ))}
      {/* cable tray */}
      <mesh
        geometry={roundedBox(1.2, 0.06, 0.12, 0.01)}
        material={M.darkMetal()}
        position={[0, 0.64, -0.25]}
      />
      {children}
    </group>
  )
}

export function Chair({ color, rotation = 0 }: { color: string; rotation?: number }) {
  return (
    <group rotation={[0, rotation, 0]}>
      <mesh
        geometry={roundedBox(0.46, 0.07, 0.46, 0.03)}
        material={M.fabric(color)}
        position={[0, 0.45, 0]}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={roundedBox(0.44, 0.5, 0.06, 0.03)}
        material={M.fabric(color)}
        position={[0, 0.74, -0.22]}
        rotation={[-0.12, 0, 0]}
        castShadow
      />
      <mesh
        geometry={roundedBox(0.05, 0.3, 0.05, 0.01)}
        material={M.darkMetal()}
        position={[0, 0.3, 0]}
      />
      {[0, 72, 144, 216, 288].map((deg) => (
        <group key={deg} rotation={[0, (deg * Math.PI) / 180, 0]}>
          <mesh
            geometry={roundedBox(0.3, 0.03, 0.04, 0.01)}
            material={M.darkMetal()}
            position={[0.15, 0.06, 0]}
          />
          <mesh position={[0.29, 0.03, 0]}>
            <sphereGeometry args={[0.03, 10, 10]} />
            <primitive object={M.darkMetal()} attach="material" />
          </mesh>
        </group>
      ))}
      {[-0.26, 0.26].map((dx) => (
        <mesh
          key={dx}
          geometry={roundedBox(0.04, 0.03, 0.26, 0.01)}
          material={M.darkMetal()}
          position={[dx, 0.66, 0.02]}
        />
      ))}
      {[-0.26, 0.26].map((dx) => (
        <mesh
          key={`p${dx}`}
          geometry={roundedBox(0.03, 0.18, 0.03, 0.01)}
          material={M.darkMetal()}
          position={[dx, 0.56, 0.02]}
        />
      ))}
    </group>
  )
}

/** A 24 inch monitor on a stand. The panel shows a live canvas texture driven by the agent's task. */
export function Monitor({ content, brightness }: { content: ScreenContent; brightness: number }) {
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
      <mesh
        geometry={roundedBox(0.22, 0.015, 0.16, 0.006)}
        material={M.darkMetal()}
        position={[0, 0.008, 0]}
      />
      <mesh
        geometry={roundedBox(0.05, 0.14, 0.03, 0.008)}
        material={M.darkMetal()}
        position={[0, 0.08, -0.02]}
      />
      <group position={[0, 0.31, 0]} rotation={[-0.06, 0, 0]}>
        <mesh geometry={roundedBox(0.56, 0.34, 0.03, 0.008)} material={M.darkMetal()} castShadow />
        <mesh position={[0, 0.005, 0.017]}>
          <planeGeometry args={[0.52, 0.3]} />
          <primitive object={mat} attach="material" />
        </mesh>
      </group>
    </group>
  )
}

export function Keyboard() {
  return (
    <group position={[0, 0.745, 0.12]}>
      <mesh
        geometry={roundedBox(0.42, 0.015, 0.13, 0.006)}
        material={M.plastic('#d8d5cf')}
        castShadow
      />
      <mesh
        geometry={roundedBox(0.09, 0.012, 0.05, 0.006)}
        material={M.plastic('#d8d5cf')}
        position={[0.3, 0, 0.01]}
      />
    </group>
  )
}

/** A desk lamp with a real point light; its warmth is a state signal. */
export function DeskLamp({ intensity, side = 1 }: { intensity: number; side?: 1 | -1 }) {
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
      <mesh
        geometry={roundedBox(0.12, 0.02, 0.12, 0.01)}
        material={M.darkMetal()}
        position={[0, 0.01, 0]}
      />
      <mesh position={[0, 0.2, 0]} rotation={[0, 0, side * 0.25]}>
        <cylinderGeometry args={[0.008, 0.008, 0.4, 8]} />
        <primitive object={M.darkMetal()} attach="material" />
      </mesh>
      <group position={[-side * 0.08, 0.4, 0]} rotation={[0, 0, side * 0.9]}>
        <mesh>
          <cylinderGeometry args={[0.03, 0.07, 0.1, 16, 1, true]} />
          <primitive object={M.darkMetal()} attach="material" />
        </mesh>
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

export function Mug({ color = '#e9e4da', x = 0.45 }: { color?: string; x?: number }) {
  return (
    <group position={[x, 0.745, 0.2]}>
      <mesh position={[0, 0.045, 0]}>
        <cylinderGeometry args={[0.04, 0.035, 0.09, 16]} />
        <primitive object={M.plastic(color)} attach="material" />
      </mesh>
      <mesh position={[0.045, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.022, 0.006, 8, 16]} />
        <primitive object={M.plastic(color)} attach="material" />
      </mesh>
    </group>
  )
}

export function Notebook({ x = -0.42 }: { x?: number }) {
  return (
    <group position={[x, 0.745, 0.18]} rotation={[0, -0.2, 0]}>
      <mesh geometry={roundedBox(0.18, 0.015, 0.24, 0.005)} material={M.paper()} />
      <mesh
        geometry={roundedBox(0.19, 0.004, 0.25, 0.003)}
        material={M.plastic('#2f2f36')}
        position={[0, -0.009, 0]}
      />
    </group>
  )
}

export function Headphones({ x = 0.3 }: { x?: number }) {
  return (
    <group position={[x, 0.76, -0.3]} rotation={[0.2, 0.4, 0]}>
      <mesh rotation={[0, 0, 0]}>
        <torusGeometry args={[0.085, 0.012, 8, 24, Math.PI]} />
        <primitive object={M.plastic('#2a2a30')} attach="material" />
      </mesh>
      {[-0.085, 0.085].map((dx) => (
        <mesh key={dx} position={[dx, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.03, 16]} />
          <primitive object={M.plastic('#2a2a30')} attach="material" />
        </mesh>
      ))}
    </group>
  )
}

export function Plant({ scale = 1 }: { scale?: number }) {
  const leaves = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        a: (i / 9) * Math.PI * 2 + (i % 2) * 0.3,
        t: 0.5 + (i % 3) * 0.25,
        l: 0.26 + (i % 4) * 0.05,
      })),
    [],
  )
  return (
    <group scale={scale}>
      <mesh position={[0, 0.14, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.14, 0.11, 0.28, 20]} />
        <primitive object={M.pot()} attach="material" />
      </mesh>
      <mesh position={[0, 0.27, 0]}>
        <cylinderGeometry args={[0.125, 0.125, 0.02, 20]} />
        <primitive object={M.plastic('#3b2f24')} attach="material" />
      </mesh>
      {leaves.map((l, i) => (
        <group key={i} position={[0, 0.28, 0]} rotation={[0, l.a, 0]}>
          <mesh position={[0.08, l.l * 0.5, 0]} rotation={[0, 0, -l.t]} castShadow>
            <sphereGeometry args={[0.07, 8, 6]} />
            <primitive object={M.leaf()} attach="material" />
          </mesh>
          <mesh
            position={[0.2, l.l, 0]}
            rotation={[0.3, 0, -l.t - 0.5]}
            scale={[1, 0.35, 2.2]}
            castShadow
          >
            <sphereGeometry args={[0.07, 10, 8]} />
            <primitive object={M.leaf()} attach="material" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export function Bookshelf({ width = 1.2, accent }: { width?: number; accent: string }) {
  const books = useMemo(() => {
    const out: { x: number; h: number; w: number; c: string }[] = []
    const cols = ['#c9533f', '#2f5d8a', '#e3a53a', '#4f8a4a', '#7a4f8a', '#d9cfbd', '#2a2b31']
    for (let shelf = 0; shelf < 3; shelf++) {
      let x = -width / 2 + 0.06
      let i = 0
      while (x < width / 2 - 0.1) {
        const w = 0.025 + ((i * 7 + shelf * 3) % 5) * 0.008
        out.push({
          x: x + w / 2,
          h: 0.16 + ((i * 5 + shelf) % 4) * 0.02,
          w,
          c: cols[(i + shelf) % cols.length] ?? '#999',
        })
        x += w + 0.004
        i++
        if (i % 9 === 8) x += 0.09
      }
    }
    return out
  }, [width])
  return (
    <group>
      {[0.02, 0.62, 1.22, 1.82].map((y) => (
        <mesh
          key={y}
          geometry={roundedBox(width, 0.03, 0.3, 0.008)}
          material={M.plastic('#3a3328')}
          position={[0, y, 0]}
          castShadow
          receiveShadow
        />
      ))}
      {[-width / 2 + 0.015, width / 2 - 0.015].map((x) => (
        <mesh
          key={x}
          geometry={roundedBox(0.03, 1.86, 0.3, 0.008)}
          material={M.plastic('#3a3328')}
          position={[x, 0.93, 0]}
          castShadow
        />
      ))}
      <mesh
        geometry={roundedBox(width, 1.86, 0.02, 0.005)}
        material={M.accent(accent)}
        position={[0, 0.93, -0.14]}
      />
      {books.map((b, i) => {
        const shelfY = [0.035, 0.635, 1.235][Math.floor(i / (books.length / 3))] ?? 0.035
        return (
          <mesh
            key={i}
            material={M.plastic(b.c)}
            position={[b.x, shelfY + b.h / 2, 0.02]}
            castShadow
          >
            <boxGeometry args={[b.w, b.h, 0.2]} />
          </mesh>
        )
      })}
    </group>
  )
}

export function Rug({ w, d, accent }: { w: number; d: number; accent: string }) {
  return (
    <mesh
      geometry={roundedBox(w, 0.012, d, 0.006)}
      material={M.rug(accent)}
      position={[0, 0.006, 0]}
      receiveShadow
    />
  )
}

/** A pendant lamp: cable, shade, warm bulb and the light it throws on the desk below. */
export function Pendant({
  height = 2.8,
  drop = 0.9,
  intensity = 2.4,
}: {
  height?: number
  drop?: number
  intensity?: number
}) {
  return (
    <group position={[0, height, 0]}>
      <mesh position={[0, -drop / 2, 0]}>
        <cylinderGeometry args={[0.004, 0.004, drop, 6]} />
        <primitive object={M.darkMetal()} attach="material" />
      </mesh>
      <mesh position={[0, -drop, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.18, 0.18, 24, 1, true]} />
        <meshStandardMaterial
          color="#2a2b31"
          roughness={0.6}
          metalness={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, -drop - 0.04, 0]}>
        <sphereGeometry args={[0.035, 12, 12]} />
        <meshStandardMaterial color="#fff3e0" emissive={PALETTE.warm} emissiveIntensity={2.2} />
      </mesh>
      <pointLight
        position={[0, -drop - 0.1, 0]}
        color={PALETTE.warm}
        intensity={intensity}
        distance={6}
        decay={1.8}
      />
    </group>
  )
}

/** A whiteboard carrying live text, drawn once per content change. */
export function Whiteboard({
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
    <group>
      <mesh
        geometry={roundedBox(w + 0.06, h + 0.06, 0.03, 0.008)}
        material={M.metal()}
        castShadow
      />
      <mesh position={[0, 0, 0.018]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={tex} roughness={0.5} />
      </mesh>
      <mesh
        geometry={roundedBox(w * 0.6, 0.04, 0.06, 0.01)}
        material={M.metal()}
        position={[0, -h / 2 - 0.05, 0.03]}
      />
    </group>
  )
}

/** The mood board: pinned photographs of Bunni from her reference set, served from the app's own copies. */
export function MoodBoard({
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
  const slots = useMemo(() => {
    const cols = 3
    return textures.map((_, i) => ({
      x: -w / 2 + 0.42 + (i % cols) * ((w - 0.84) / (cols - 1)),
      y: h / 2 - 0.4 - Math.floor(i / cols) * 0.62,
      r: (((i * 37) % 9) - 4) * 0.01,
    }))
  }, [textures, w, h])
  return (
    <group>
      <mesh geometry={roundedBox(w, h, 0.04, 0.01)} material={M.fabric('#5a4a3a')} castShadow />
      <mesh
        geometry={roundedBox(w + 0.05, h + 0.05, 0.02, 0.008)}
        material={M.plastic('#3a3328')}
        position={[0, 0, -0.012]}
      />
      {textures.map((t, i) => {
        const s = slots[i]
        if (!s) return null
        return (
          <group key={i} position={[s.x, s.y, 0.03]} rotation={[0, 0, s.r]}>
            <mesh position={[0, 0, -0.004]}>
              <planeGeometry args={[0.48, 0.5]} />
              <primitive object={M.paper()} attach="material" />
            </mesh>
            <mesh>
              <planeGeometry args={[0.44, 0.44]} />
              <meshStandardMaterial map={t} roughness={0.7} />
            </mesh>
            <mesh position={[0, 0.24, 0.006]}>
              <sphereGeometry args={[0.012, 8, 8]} />
              <meshStandardMaterial color={PALETTE.pink} roughness={0.4} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

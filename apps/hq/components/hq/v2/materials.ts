'use client'
import * as THREE from 'three'

/**
 * The material library. One place for every surface in the building, so the whole scene responds
 * to light the same way and a change of palette is a change here. Colours from the art direction.
 */
export const PALETTE = {
  night: '#0b0e18',
  charcoal: '#2a2b31',
  offWhite: '#e8e4dc',
  oak: '#a8865a',
  warm: '#ffd2a0',
  screen: '#d7e3ff',
  pink: '#f28bb5',
  accents: {
    executive: '#8e7cc3',
    creative: '#e3a53a',
    production: '#5aa9d6',
    growth: '#5cc39a',
    commercial: '#d9955e',
    operations: '#9aa0ad',
  } as Record<string, string>,
}

const cache = new Map<string, THREE.Material>()
const mat = (key: string, make: () => THREE.Material): THREE.Material => {
  let m = cache.get(key)
  if (!m) {
    m = make()
    cache.set(key, m)
  }
  return m
}

/** A subtle wood-grain texture drawn once; 512 px is plenty at the room framing. */
const oakTexture = (() => {
  let tex: THREE.CanvasTexture | null = null
  return () => {
    if (tex) return tex
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 512
    const x = c.getContext('2d')!
    x.fillStyle = '#a8865a'
    x.fillRect(0, 0, 512, 512)
    for (let i = 0; i < 9; i++) {
      x.fillStyle = i % 2 ? '#a17f54' : '#ad8c60'
      x.fillRect(0, i * 57, 512, 57)
      x.fillStyle = 'rgba(60,40,20,0.35)'
      x.fillRect(0, i * 57, 512, 1)
    }
    for (let i = 0; i < 900; i++) {
      x.fillStyle = `rgba(${90 + Math.random() * 40},${60 + Math.random() * 30},${30 + Math.random() * 20},${0.05 + Math.random() * 0.08})`
      const y = Math.random() * 512
      x.fillRect(Math.random() * 512, y, 20 + Math.random() * 120, 1)
    }
    tex = new THREE.CanvasTexture(c)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(4, 4)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    return tex
  }
})()

export const M = {
  floor: () =>
    mat(
      'floor',
      () => new THREE.MeshStandardMaterial({ map: oakTexture(), roughness: 0.55, metalness: 0.02 }),
    ),
  slab: () =>
    mat('slab', () => new THREE.MeshStandardMaterial({ color: '#3a3b42', roughness: 0.9 })),
  ground: () =>
    mat(
      'ground',
      () => new THREE.MeshStandardMaterial({ color: '#0e1017', roughness: 0.35, metalness: 0.1 }),
    ),
  wall: () =>
    mat('wall', () => new THREE.MeshStandardMaterial({ color: PALETTE.offWhite, roughness: 0.92 })),
  charcoal: () =>
    mat(
      'charcoal',
      () =>
        new THREE.MeshStandardMaterial({
          color: PALETTE.charcoal,
          roughness: 0.7,
          metalness: 0.15,
        }),
    ),
  glass: () =>
    mat(
      'glass',
      () =>
        new THREE.MeshPhysicalMaterial({
          color: '#cfe0ff',
          transmission: 0.0,
          transparent: true,
          opacity: 0.18,
          roughness: 0.08,
          metalness: 0,
          clearcoat: 1,
          clearcoatRoughness: 0.1,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
    ),
  metal: () =>
    mat(
      'metal',
      () => new THREE.MeshStandardMaterial({ color: '#8d9099', roughness: 0.35, metalness: 0.85 }),
    ),
  darkMetal: () =>
    mat(
      'darkMetal',
      () => new THREE.MeshStandardMaterial({ color: '#2b2c31', roughness: 0.45, metalness: 0.7 }),
    ),
  deskTop: () =>
    mat('deskTop', () => new THREE.MeshStandardMaterial({ color: '#d9cfbd', roughness: 0.6 })),
  fabric: (color: string) =>
    mat(`fabric:${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.95 })),
  plastic: (color: string) =>
    mat(
      `plastic:${color}`,
      () => new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.05 }),
    ),
  skin: (color: string) =>
    mat(`skin:${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.75 })),
  hair: (color: string) =>
    mat(`hair:${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.6 })),
  leaf: () =>
    mat(
      'leaf',
      () =>
        new THREE.MeshStandardMaterial({
          color: '#4f8a4a',
          roughness: 0.8,
          side: THREE.DoubleSide,
        }),
    ),
  pot: () => mat('pot', () => new THREE.MeshStandardMaterial({ color: '#b9a089', roughness: 0.9 })),
  paper: () =>
    mat('paper', () => new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.95 })),
  accent: (key: string) =>
    mat(
      `accent:${key}`,
      () =>
        new THREE.MeshStandardMaterial({ color: PALETTE.accents[key] ?? '#999', roughness: 0.85 }),
    ),
  rug: (key: string) =>
    mat(
      `rug:${key}`,
      () =>
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(PALETTE.accents[key] ?? '#999').multiplyScalar(0.55),
          roughness: 1,
        }),
    ),
  emissive: (color: string, intensity = 1) =>
    new THREE.MeshStandardMaterial({
      color: '#111',
      emissive: color,
      emissiveIntensity: intensity,
      roughness: 0.4,
    }),
}

/** Rounded box geometry, cached by dimensions. The bevel is what makes boxes catch light on their edges. */
const geoCache = new Map<string, THREE.BufferGeometry>()
export const roundedBox = (
  w: number,
  h: number,
  d: number,
  r = 0.02,
  seg = 2,
): THREE.BufferGeometry => {
  const key = `${w}|${h}|${d}|${r}|${seg}`
  let g = geoCache.get(key)
  if (!g) {
    const shape = new THREE.Shape()
    const x = -w / 2
    const y = -h / 2
    const rr = Math.min(r, w / 2, h / 2)
    shape.moveTo(x + rr, y)
    shape.lineTo(x + w - rr, y)
    shape.quadraticCurveTo(x + w, y, x + w, y + rr)
    shape.lineTo(x + w, y + h - rr)
    shape.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
    shape.lineTo(x + rr, y + h)
    shape.quadraticCurveTo(x, y + h, x, y + h - rr)
    shape.lineTo(x, y + rr)
    shape.quadraticCurveTo(x, y, x + rr, y)
    g = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(0.001, d - 2 * rr),
      bevelEnabled: true,
      bevelThickness: rr,
      bevelSize: rr,
      bevelSegments: seg,
      curveSegments: 3,
    })
    g.center()
    geoCache.set(key, g)
  }
  return g
}

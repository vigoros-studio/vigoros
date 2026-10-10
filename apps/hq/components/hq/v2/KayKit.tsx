'use client'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { Batch, Vec3 } from './batch'
import { PALETTE } from './materials'

/**
 * KayKit Furniture Bits (CC0, see docs/assets/REGISTER.md) as batch contributions. The pack paints
 * everything from one palette atlas, so a room of it merges into a single draw call. We swap the
 * atlas for one in the Vigoros palette, cell for cell, and leave the files untouched.
 */
export const KAYKIT = '/models/kaykit-furniture-bits'
export const KAYKIT_SCALE = 0.75

export const KAYKIT_MODELS = [
  'table_medium',
  'chair_B',
  'chair_C',
  'shelf_B_large_decorated',
  'shelf_B_small_decorated',
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
] as const
export type KayKitModel = (typeof KAYKIT_MODELS)[number]

export const kaykitUrl = (m: KayKitModel) => `${KAYKIT}/${m}.gltf`
for (const m of KAYKIT_MODELS) useGLTF.preload(kaykitUrl(m))

/**
 * The replacement atlas. The original is a 4 by 8 grid of vertical gradients; each cell here is
 * the same gradient shape in our colours (wood becomes oak, orange becomes the creative accent,
 * blue becomes charcoal so chairs read as office chairs, greens become the plant colour).
 */
let atlas: THREE.CanvasTexture | null = null
export const kaykitAtlas = (): THREE.CanvasTexture => {
  if (atlas) return atlas
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 1024
  const x = c.getContext('2d')!
  const cell = (x0: number, y0: number, w: number, h: number, top: string, bottom: string) => {
    const g = x.createLinearGradient(0, y0, 0, y0 + h)
    g.addColorStop(0, top)
    g.addColorStop(1, bottom)
    x.fillStyle = g
    x.fillRect(x0, y0, w, h)
  }
  const shade = (hex: string, k: number) => new THREE.Color(hex).multiplyScalar(k).getStyle()
  const oak = PALETTE.oak
  const walnut = '#5a4634'
  const charcoal = PALETTE.charcoal
  const off = PALETTE.offWhite
  // row 0: wood planks, tan, grey-blue, light
  cell(0, 0, 640, 250, shade(oak, 1.08), shade(oak, 0.78))
  for (const px of [120, 245, 370, 495]) cell(px, 20, 14, 220, shade(oak, 0.7), shade(oak, 0.6))
  cell(640, 0, 128, 250, '#d9cfbd', '#c4b8a2')
  cell(768, 0, 128, 250, '#4a4c55', charcoal)
  cell(896, 0, 128, 250, '#f4f1ea', '#dcd7cc')
  // row 1: orange → creative accent, blue → charcoal, light, rust → book red
  cell(
    0,
    250,
    256,
    262,
    shade(PALETTE.accents['creative'] ?? '#e3a53a', 1.05),
    shade('#e3a53a', 0.72),
  )
  cell(256, 250, 256, 262, '#3a3b44', '#222329')
  cell(512, 250, 384, 262, '#f4f1ea', '#cfc9bd')
  cell(896, 250, 128, 262, '#c9533f', '#8f3a2c')
  // row 2: light grey, beige, black, white, tan, brown, teal, green
  cell(0, 512, 128, 256, '#e2dfd8', '#b9b4aa')
  cell(128, 512, 128, 256, '#d9cfbd', '#b7ab96')
  cell(256, 512, 128, 256, '#2a2b31', '#0d0e11')
  cell(384, 512, 128, 256, '#f7f5f0', '#c9c4b8')
  cell(512, 512, 128, 256, shade(oak, 1.15), shade(oak, 0.9))
  cell(640, 512, 128, 256, shade(walnut, 1.1), shade(walnut, 0.7))
  cell(768, 512, 128, 256, '#5aa9a0', '#2f6e67')
  cell(896, 512, 128, 256, '#6fa65a', '#3f7a3a')
  // row 3: metal gradients, kept neutral
  cell(0, 768, 128, 256, '#9a9ea8', '#4d5058')
  cell(128, 768, 128, 256, '#f2f2f2', '#2a2b31')
  cell(256, 768, 256, 256, '#b9bcc4', '#5b5e66')
  cell(512, 768, 256, 256, '#f2f2f2', '#2a2b31')
  cell(768, 768, 256, 256, '#b9bcc4', '#5b5e66')
  atlas = new THREE.CanvasTexture(c)
  atlas.colorSpace = THREE.SRGBColorSpace
  atlas.flipY = false // glTF convention
  atlas.anisotropy = 4
  return atlas
}

let material: THREE.MeshStandardMaterial | null = null
export const kaykitMaterial = (): THREE.MeshStandardMaterial => {
  if (!material)
    material = new THREE.MeshStandardMaterial({ map: kaykitAtlas(), roughness: 0.72, metalness: 0 })
  return material
}

/** Add an authored model's meshes into the batch under the current transform. */
export const addKayKit = (
  b: Batch,
  gltf: { scene: THREE.Group },
  position: Vec3 = [0, 0, 0],
  rotationY = 0,
  scale: number | Vec3 = KAYKIT_SCALE,
) => {
  const root = gltf.scene
  root.updateMatrixWorld(true)
  b.push(position, [0, rotationY, 0], scale)
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    b.addMatrix(m.geometry, kaykitMaterial(), m.matrixWorld)
  })
  b.pop()
}

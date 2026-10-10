'use client'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Static batching. Everything in the building that never moves (walls, desks, shelves, books,
 * lamp bodies) is merged into one geometry per material, so a room costs a handful of draw calls
 * however much furniture it holds. Builders push transforms like a scene graph and add primitives;
 * `build()` returns the merged parts. Anything that animates, lights up or carries its own texture
 * stays a normal mesh.
 */
export type Vec3 = [number, number, number]

export interface Part {
  geometry: THREE.BufferGeometry
  material: THREE.Material
  castShadow: boolean
  receiveShadow: boolean
}

interface Group {
  material: THREE.Material
  castShadow: boolean
  receiveShadow: boolean
  geometries: THREE.BufferGeometry[]
}

export class Batch {
  private groups = new Map<string, Group>()
  private stack: THREE.Matrix4[] = [new THREE.Matrix4()]
  private readonly local = new THREE.Matrix4()
  private readonly q = new THREE.Quaternion()
  private readonly e = new THREE.Euler()
  private readonly p = new THREE.Vector3()
  private readonly s = new THREE.Vector3()
  private keys = new WeakMap<THREE.Material, number>()
  private nextKey = 1

  private compose(position: Vec3, rotation: Vec3, scale: number | Vec3): THREE.Matrix4 {
    this.p.set(position[0], position[1], position[2])
    this.e.set(rotation[0], rotation[1], rotation[2])
    this.q.setFromEuler(this.e)
    if (typeof scale === 'number') this.s.set(scale, scale, scale)
    else this.s.set(scale[0], scale[1], scale[2])
    return this.local.compose(this.p, this.q, this.s)
  }

  private get top(): THREE.Matrix4 {
    return this.stack[this.stack.length - 1]!
  }

  /** Enter a child transform, like a nested `<group>`. */
  push(position: Vec3 = [0, 0, 0], rotation: Vec3 = [0, 0, 0], scale: number | Vec3 = 1): this {
    const m = this.top.clone().multiply(this.compose(position, rotation, scale))
    this.stack.push(m)
    return this
  }

  pop(): this {
    if (this.stack.length > 1) this.stack.pop()
    return this
  }

  /** Run a builder inside a transform and come back out. */
  at(position: Vec3, rotation: Vec3, fn: () => void, scale: number | Vec3 = 1): this {
    this.push(position, rotation, scale)
    fn()
    this.pop()
    return this
  }

  /** Add a primitive under the current transform. The geometry is copied, never modified. */
  add(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position: Vec3 = [0, 0, 0],
    rotation: Vec3 = [0, 0, 0],
    scale: number | Vec3 = 1,
    opts: { castShadow?: boolean; receiveShadow?: boolean } = {},
  ): this {
    const cast = opts.castShadow ?? true
    const receive = opts.receiveShadow ?? true
    let k = this.keys.get(material)
    if (!k) {
      k = this.nextKey++
      this.keys.set(material, k)
    }
    const key = `${k}|${cast ? 1 : 0}|${receive ? 1 : 0}`
    let g = this.groups.get(key)
    if (!g) {
      g = { material, castShadow: cast, receiveShadow: receive, geometries: [] }
      this.groups.set(key, g)
    }
    const world = this.top.clone().multiply(this.compose(position, rotation, scale))
    const copy = geometry.index ? geometry.toNonIndexed() : geometry.clone()
    // Merging needs the same attribute set everywhere; drop anything beyond position, normal, uv.
    for (const name of Object.keys(copy.attributes))
      if (name !== 'position' && name !== 'normal' && name !== 'uv') copy.deleteAttribute(name)
    if (!copy.attributes['normal']) copy.computeVertexNormals()
    if (!copy.attributes['uv']) {
      const n = copy.attributes['position']!.count
      copy.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2))
    }
    copy.applyMatrix4(world)
    g.geometries.push(copy)
    return this
  }

  /** Add a primitive with an explicit local matrix (for authored meshes with their own transforms). */
  addMatrix(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    matrix: THREE.Matrix4,
    opts: { castShadow?: boolean; receiveShadow?: boolean } = {},
  ): this {
    this.stack.push(this.top.clone().multiply(matrix))
    this.add(geometry, material, [0, 0, 0], [0, 0, 0], 1, opts)
    this.stack.pop()
    return this
  }

  /** Merge everything added so far. Call once; the batch is spent afterwards. */
  build(): Part[] {
    const parts: Part[] = []
    for (const g of this.groups.values()) {
      if (g.geometries.length === 0) continue
      const merged = mergeGeometries(g.geometries, false)
      for (const geo of g.geometries) geo.dispose()
      if (!merged) continue
      merged.computeBoundingSphere()
      parts.push({
        geometry: merged,
        material: g.material,
        castShadow: g.castShadow,
        receiveShadow: g.receiveShadow,
      })
    }
    this.groups.clear()
    return parts
  }
}

/** Primitive geometries shared by builders, cached by their arguments. */
const primCache = new Map<string, THREE.BufferGeometry>()
const prim = (key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry => {
  let g = primCache.get(key)
  if (!g) {
    g = make()
    primCache.set(key, g)
  }
  return g
}
export const box = (w: number, h: number, d: number) =>
  prim(`box|${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d))
export const cylinder = (rt: number, rb: number, h: number, seg = 16, open = false) =>
  prim(
    `cyl|${rt}|${rb}|${h}|${seg}|${open ? 1 : 0}`,
    () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open),
  )
export const sphere = (r: number, ws = 10, hs = 8) =>
  prim(`sph|${r}|${ws}|${hs}`, () => new THREE.SphereGeometry(r, ws, hs))
export const torus = (r: number, t: number, rs = 8, ts = 16, arc = Math.PI * 2) =>
  prim(`tor|${r}|${t}|${rs}|${ts}|${arc}`, () => new THREE.TorusGeometry(r, t, rs, ts, arc))
export const capsule = (r: number, l: number, cs = 6, rs = 12) =>
  prim(`cap|${r}|${l}|${cs}|${rs}`, () => new THREE.CapsuleGeometry(r, l, cs, rs))
export const plane = (w: number, h: number) =>
  prim(`pl|${w}|${h}`, () => new THREE.PlaneGeometry(w, h))

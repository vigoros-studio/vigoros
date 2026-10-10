'use client'
import { useEffect, useMemo } from 'react'
import { Batch, type Part } from './batch'

const noRaycast = () => null

/**
 * Renders a builder's output as one mesh per material. The merged meshes never answer raycasts;
 * anything clickable keeps its own invisible hit volume, which is cheaper than testing a wall of
 * triangles on every pointer move.
 */
export function Batched({
  build,
  deps,
  receiveShadow = true,
}: {
  build: (b: Batch) => void
  deps: readonly unknown[]
  receiveShadow?: boolean
}) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const parts: Part[] = useMemo(() => {
    const b = new Batch()
    build(b)
    return b.build()
  }, deps)
  useEffect(() => () => parts.forEach((p) => p.geometry.dispose()), [parts])
  return (
    <group>
      {parts.map((p, i) => (
        <mesh
          key={i}
          geometry={p.geometry}
          material={p.material}
          castShadow={p.castShadow}
          receiveShadow={receiveShadow && p.receiveShadow}
          raycast={noRaycast}
          frustumCulled
        />
      ))}
    </group>
  )
}

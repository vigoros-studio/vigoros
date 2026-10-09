'use client'
import { MapControls, OrthographicCamera } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useHq } from '@/lib/store'

/**
 * Isometric orthographic camera with pan, zoom and a little rotation, plus smooth focus
 * transitions when something is selected. The rig never moves on its own.
 */
export function CameraRig({ center }: { center: { x: number; z: number } }) {
  const controls = useRef<{
    target: THREE.Vector3
    update: () => void
    object: THREE.Camera
  } | null>(null)
  const focus = useHq((s) => s.focus)
  const { camera, size } = useThree()
  const goal = useRef({ x: center.x, z: center.z, zoom: 1 })

  useEffect(() => {
    if (focus) goal.current = focus
  }, [focus])

  useEffect(() => {
    const cam = camera as THREE.OrthographicCamera
    cam.position.set(center.x + 24, 24, center.z + 24)
    cam.lookAt(center.x, 0, center.z)
    if (controls.current) controls.current.target.set(center.x, 0, center.z)
  }, [camera, center.x, center.z])

  useFrame((_, dt) => {
    const c = controls.current
    if (!c) return
    const k = 1 - Math.exp(-dt * 3)
    const g = goal.current
    const cam = camera as THREE.OrthographicCamera
    const baseZoom = Math.min(size.width, size.height) / 26
    const wantZoom = baseZoom * g.zoom
    const dx = g.x - c.target.x
    const dz = g.z - c.target.z
    if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01 || Math.abs(cam.zoom - wantZoom) > 0.5) {
      c.target.x += dx * k
      c.target.z += dz * k
      cam.position.x += dx * k
      cam.position.z += dz * k
      cam.zoom += (wantZoom - cam.zoom) * k
      cam.updateProjectionMatrix()
      c.update()
    }
  })

  return (
    <>
      <OrthographicCamera
        makeDefault
        position={[center.x + 24, 24, center.z + 24]}
        zoom={40}
        near={-50}
        far={200}
      />
      <MapControls
        ref={controls as never}
        enableDamping
        dampingFactor={0.12}
        enableRotate
        minPolarAngle={Math.PI / 5}
        maxPolarAngle={Math.PI / 3.2}
        minAzimuthAngle={Math.PI / 4 - 0.6}
        maxAzimuthAngle={Math.PI / 4 + 0.6}
        minZoom={12}
        maxZoom={160}
        onStart={() => useHq.getState().setFocus(null)}
      />
    </>
  )
}

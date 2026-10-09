'use client'
import * as THREE from 'three'

export interface ScreenContent {
  title: string
  state: string
  kind: string
  lines: string[]
  simulated: boolean
}

/**
 * A monitor's picture, drawn with 2D canvas and uploaded as a texture. It shows the agent's real
 * task; when nothing runs it shows the standby screen. 512 by 320 is sharp at the employee framing.
 */
export class ScreenTexture {
  readonly texture: THREE.CanvasTexture
  private readonly canvas: HTMLCanvasElement
  private last = ''

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.width = 512
    this.canvas.height = 320
    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.colorSpace = THREE.SRGBColorSpace
    this.texture.anisotropy = 4
    this.draw({ title: '', state: 'idle', kind: '', lines: [], simulated: false }, 0)
  }

  draw(c: ScreenContent, t: number) {
    const key = JSON.stringify(c) + (c.state === 'working' ? Math.floor(t * 2) % 2 : '')
    if (key === this.last) return
    this.last = key
    const x = this.canvas.getContext('2d')!
    const W = this.canvas.width
    const H = this.canvas.height
    const active = c.state === 'working' || c.state === 'reviewing'
    x.fillStyle = active ? '#1b2130' : '#0e1118'
    x.fillRect(0, 0, W, H)
    if (!active) {
      x.fillStyle = '#39414f'
      x.font = '500 22px -apple-system, Inter, system-ui, sans-serif'
      x.fillText('Vigoros Studio', 28, 160)
      x.font = '16px -apple-system, Inter, system-ui, sans-serif'
      x.fillStyle = '#2b3240'
      x.fillText(
        c.state === 'blocked'
          ? 'waiting for a decision'
          : c.state === 'waiting'
            ? 'waiting on another desk'
            : 'standby',
        28,
        190,
      )
      this.texture.needsUpdate = true
      return
    }
    // Window chrome
    x.fillStyle = '#242c3d'
    x.fillRect(0, 0, W, 36)
    for (let i = 0; i < 3; i++) {
      x.fillStyle = ['#ff5f57', '#febc2e', '#28c840'][i] ?? '#888'
      x.beginPath()
      x.arc(22 + i * 20, 18, 6, 0, Math.PI * 2)
      x.fill()
    }
    x.fillStyle = '#9fb0d0'
    x.font = '500 14px -apple-system, Inter, system-ui, sans-serif'
    x.fillText(c.kind.replace(/\./g, ' · '), 96, 23)
    if (c.simulated) {
      x.fillStyle = '#e3a53a'
      x.font = '600 12px -apple-system, Inter, system-ui, sans-serif'
      x.fillText('SIMULATED', W - 100, 23)
    }
    // Document
    x.fillStyle = '#e9edf5'
    x.font = '600 20px -apple-system, Inter, system-ui, sans-serif'
    const title = c.title.length > 44 ? `${c.title.slice(0, 43)}…` : c.title
    x.fillText(title, 28, 76)
    x.fillStyle = '#b7c2d8'
    x.font = '15px -apple-system, Inter, system-ui, sans-serif'
    const lines = c.lines.length ? c.lines : ['Drafting…']
    lines
      .slice(0, 9)
      .forEach((l, i) => x.fillText(l.length > 56 ? `${l.slice(0, 55)}…` : l, 28, 112 + i * 22))
    if (c.state === 'working' && Math.floor(t * 2) % 2 === 0) {
      x.fillStyle = '#ffd2a0'
      x.fillRect(
        28 + x.measureText(lines[Math.min(lines.length, 9) - 1] ?? '').width + 4,
        100 + (Math.min(lines.length, 9) - 1) * 22,
        9,
        16,
      )
    }
    this.texture.needsUpdate = true
  }
}

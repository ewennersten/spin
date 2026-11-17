import * as THREE from 'three'
import type { SceneFactory } from './scene'

const MAX_COLS = 81 // punkter tvärs över
const MAX_ROWS = 100 // punkter på djupet
const HALF_WIDTH = 40
const DEPTH = 100 // rutnätets längd; bortre kanten ligger i dimman
const ROAD = 2.5 // halva bredden på den platta dalen mitt i

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// Berg av sinusåsar, 0 till 1. u är läget i landskapet, så bergen följer med när rutnätet rullar.
const ridge = (x: number, u: number) =>
  0.5 * Math.abs(Math.sin(0.31 * x + 0.23 * u))
  + 0.3 * Math.abs(Math.sin(0.53 * x - 0.17 * u + 2.1))
  + 0.2 * (0.5 + 0.5 * Math.sin(0.11 * x + 0.07 * u + 4))

// Bergens höjd vid x: platt dal i mitten, basen formar de inre bergen, mellanregistret mitten och diskanten de yttersta.
export function heightAt(x: number, u: number, bass: number, mid: number, treble: number, amp: number): number {
  const ax = Math.abs(x)
  const t = Math.min(1, ax / HALF_WIDTH)
  const band = bass * (1 - t) ** 2 + mid * 2 * t * (1 - t) + treble * t * t
  return smoothstep(ROAD, 12, ax) * ridge(x, u) * amp * (0.35 + 0.9 * band) * (0.5 + t)
}

// Ett lysande rutnät rullar mot kameran mellan berg som formas av ljudbanden.
export const grid: SceneFactory = () => {
  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(0x000000, 8, DEPTH - 5)
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 200)
  camera.position.set(0, 2, 0)
  const material = new THREE.LineBasicMaterial({ vertexColors: true })
  let geometry = new THREE.BufferGeometry()
  const lines = new THREE.LineSegments(geometry, material)
  // Samma rutnät speglat i taket, så att himlen över horisonten inte står tom.
  const ceiling = new THREE.LineSegments(geometry, material)
  ceiling.scale.y = -1
  ceiling.position.y = 2 * camera.position.y
  for (const l of [lines, ceiling]) {
    l.frustumCulled = false // höjderna ändras varje bildruta, så den beräknade gränsen stämmer aldrig
    scene.add(l)
  }
  let cols = 0
  let rows = 0
  let spacing = 1
  let travel = 0
  let sway = 0

  const build = (fraction: number) => {
    cols = Math.max(25, Math.round(MAX_COLS * fraction))
    rows = Math.max(30, Math.round(MAX_ROWS * fraction))
    spacing = DEPTH / (rows - 1)
    const positions = new Float32Array(cols * rows * 3)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = (r * cols + c) * 3
        positions[i] = -HALF_WIDTH + (2 * HALF_WIDTH * c) / (cols - 1)
        positions[i + 2] = -r * spacing
      }
    }
    const index: number[] = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = r * cols + c
        if (c + 1 < cols) index.push(v, v + 1)
        if (r + 1 < rows) index.push(v, v + cols)
      }
    }
    geometry.dispose()
    geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(cols * rows * 3), 3))
    geometry.setIndex(index)
    lines.geometry = geometry
    ceiling.geometry = geometry
  }
  build(1)

  return {
    scene,
    camera,
    update(input) {
      const { bass, mid, treble } = input.bands
      travel += (input.calm ? 2 : 5 + 35 * input.intensity) * input.dtSec
      sway += (input.calm ? 0.15 : 0.3 + 0.7 * input.intensity) * input.dtSec
      camera.rotation.set(-0.08, 0, Math.sin(sway) * (input.calm ? 0.02 : 0.03 + 0.1 * input.intensity))
      // Rutnätet flyttas bara en del av en ruta; hela rutor räknas in i landskapets läge u.
      const shift = Math.floor(travel / spacing)
      lines.position.z = ceiling.position.z = travel - shift * spacing
      const amp = (input.calm ? 1.5 : 2 + 6 * input.intensity) * (1 + 0.25 * input.pulse)
      const top = amp * 1.5 * 1.25 // högsta möjliga höjd, för ljusare toppar
      const pos = geometry.attributes.position as THREE.BufferAttribute
      const col = geometry.attributes.color as THREE.BufferAttribute
      const p = pos.array as Float32Array
      const k = col.array as Float32Array
      for (let r = 0; r < rows; r++) {
        const u = (r + shift) * spacing
        for (let c = 0; c < cols; c++) {
          const i = (r * cols + c) * 3
          const h = heightAt(p[i], u, bass, mid, treble, amp)
          p[i + 1] = h
          k[i] = k[i + 1] = k[i + 2] = 0.35 + 0.65 * Math.min(1, h / top)
        }
      }
      pos.needsUpdate = true
      col.needsUpdate = true
      const glow = (input.calm ? 0.18 : 0.35 + 0.35 * input.intensity) * (1 + 0.7 * input.pulse)
      material.color.set(input.color).multiplyScalar(glow)
    },
    setParticles(fraction) {
      build(fraction)
    },
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}

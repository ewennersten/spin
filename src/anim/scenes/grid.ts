import * as THREE from 'three'
import type { SceneFactory } from './scene'

const MAX_COLS = 81 // punkter tvärs över
const MAX_ROWS = 100 // punkter på djupet
const HALF_WIDTH = 40
const DEPTH = 100 // rutnätets längd; bortre kanten ligger i dimman
const ROAD = 2.5 // halva bredden på den platta dalen mitt i
const EYE = 2 // kamerans höjd
const CEILING = 16 // takets höjd; bergen är högst 7,5, så golvets och takets berg möts aldrig
const lerp = THREE.MathUtils.lerp

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// Bergens form, 0 till 1: platt dal i mitten, berg längs sidorna av sinusåsar. u är läget i landskapet,
// så bergen följer med när rutnätet rullar. Formen styr linjernas ljushet; ljudbanden gör det inte.
const shape = (x: number, u: number) =>
  smoothstep(ROAD, 9, Math.abs(x)) * (
    0.5 * Math.abs(Math.sin(0.31 * x + 0.23 * u))
    + 0.3 * Math.abs(Math.sin(0.53 * x - 0.17 * u + 2.1))
    + 0.2 * (0.5 + 0.5 * Math.sin(0.11 * x + 0.07 * u + 4)))

// Ljudbandens vikt vid x, 0,28 till 1: basen formar de inre bergen, mellanregistret mitten och diskanten de yttersta.
const bandAt = (x: number, bass: number, mid: number, treble: number) => {
  const t = Math.min(1, Math.abs(x) / HALF_WIDTH)
  return (0.35 + 0.9 * (bass * (1 - t) ** 2 + mid * 2 * t * (1 - t) + treble * t * t)) / 1.25
}

export function heightAt(x: number, u: number, bass: number, mid: number, treble: number, amp: number): number {
  return shape(x, u) * bandAt(x, bass, mid, treble) * amp
}

// Ett lysande rutnät rullar mot kameran i en dal mellan berg som formas av ljudbanden, med samma nät speglat i taket.
export const grid: SceneFactory = () => {
  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(0x000000, 10, DEPTH - 5)
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 200)
  camera.position.set(0, EYE, 0)
  const material = new THREE.LineBasicMaterial({ vertexColors: true })
  let geometry = new THREE.BufferGeometry()
  const lines = new THREE.LineSegments(geometry, material)
  const ceiling = new THREE.LineSegments(geometry, material)
  ceiling.scale.y = -1
  ceiling.position.y = CEILING
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
    const c2 = Math.max(25, Math.round(MAX_COLS * fraction))
    const r2 = Math.max(30, Math.round(MAX_ROWS * fraction))
    if (c2 === cols && r2 === rows) return
    cols = c2
    rows = r2
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
      const m = input.calmMix
      const i = input.intensity
      travel += lerp(5 + 35 * i, 2, m) * input.dtSec
      sway += lerp(0.3 + 0.7 * i, 0.15, m) * input.dtSec
      camera.rotation.set(-0.08, 0, Math.sin(sway) * lerp(0.03 + 0.1 * i, 0.02, m))
      // Rutnätet flyttas bara en del av en ruta; hela rutor räknas in i landskapets läge u.
      const shift = Math.floor(travel / spacing)
      lines.position.z = ceiling.position.z = travel - shift * spacing
      const amp = lerp(3.5 + 3 * i, 2, m) * (1 + 0.15 * input.pulse) // högst 6,5 × 1,15 ≈ 7,5
      const pos = geometry.attributes.position as THREE.BufferAttribute
      const col = geometry.attributes.color as THREE.BufferAttribute
      const p = pos.array as Float32Array
      const k = col.array as Float32Array
      for (let r = 0; r < rows; r++) {
        const u = (r + shift) * spacing
        for (let c = 0; c < cols; c++) {
          const j = (r * cols + c) * 3
          const s = shape(p[j], u)
          p[j + 1] = s * bandAt(p[j], bass, mid, treble) * amp
          k[j] = k[j + 1] = k[j + 2] = 0.5 + 0.5 * s
        }
      }
      pos.needsUpdate = true
      col.needsUpdate = true
      const lit = (x: number) => 0.5 + 0.6 * x
      // Lugnt läge: dämpat men synligt i vila, och i en paus aldrig ljusare än samma procent när passet går.
      const calmGlow = input.runIntensity === null ? 0.8 : Math.min(0.8, lit(input.runIntensity))
      const glow = lerp(lit(i), calmGlow, m) * (1 + 0.7 * input.pulse)
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

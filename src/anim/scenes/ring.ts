import * as THREE from 'three'
import type { SceneFactory } from './scene'

export const MAX_BARS = 96
const R = 10 // ringens radie; kameran står i mitten
const STEP = (2 * Math.PI) / MAX_BARS
const WIDTH = 0.7 * STEP * R
const DEPTH = 1.2
const FADE_SEC = 0.5 // staplar som kommer till eller tas bort växer fram eller krymper bort så här fort
const lerp = THREE.MathUtils.lerp

// Ljudbandens vikt vid vinkeln a i ringen: basen vid 0, diskanten mitt emot, mellanregistret emellan.
export function bandAt(a: number, bass: number, mid: number, treble: number): number {
  const s = 0.5 - 0.5 * Math.cos(a)
  return bass * (1 - s) ** 2 + mid * 2 * s * (1 - s) + treble * s * s
}

// 3D-staplar i en ring runt kameran. De växer uppåt och nedåt från ögonhöjd, så att de syns ovanför och under
// plattorna och reser sig högst längs bildens kanter, där de är närmast.
export const ring: SceneFactory = () => {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 200)
  const geometry = new THREE.BoxGeometry(1, 2, 1, 1, 2, 1)
  // Topparna lyser starkast. Formen ger ljusheten; ljudbanden gör det inte.
  const ys = geometry.attributes.position.array
  const shade = new Float32Array(geometry.attributes.position.count * 3).map((_, j) => 0.2 + 0.8 * Math.abs(ys[j - (j % 3) + 1]))
  geometry.setAttribute('color', new THREE.BufferAttribute(shade, 3))
  const material = new THREE.MeshBasicMaterial({ vertexColors: true })
  const bars = new THREE.InstancedMesh(geometry, material, MAX_BARS)
  bars.frustumCulled = false // staplarna flyttas varje bildruta, så den beräknade gränsen stämmer aldrig
  scene.add(bars)
  const dummy = new THREE.Object3D()
  const base = new THREE.Color()
  // Ordningen i vilken staplar tas bort: den gyllene vinkeln sprider de kvarvarande jämnt runt ringen.
  const rank = Array.from({ length: MAX_BARS }, (_, n) => (n * 0.6180339887) % 1)
  const freq = Array.from({ length: MAX_BARS }, () => 0.4 + 0.8 * Math.random())
  const phase = Array.from({ length: MAX_BARS }, () => 2 * Math.PI * Math.random())
  const vis = new Array<number>(MAX_BARS).fill(1)
  let fraction = 1
  let seeded = false
  let spin = 0
  let sway = 0
  let color = ''

  return {
    scene,
    camera,
    update(input) {
      const { bass, mid, treble } = input.bands
      const m = input.calmMix
      const i = input.intensity
      const t = input.timeSec
      const dt = input.dtSec
      if (input.color !== color) {
        color = input.color
        base.set(color)
      }
      spin += lerp(0.08 + 0.5 * i, 0.03, m) * dt
      sway += lerp(0.3 + 0.7 * i, 0.15, m) * dt
      camera.rotation.set(Math.sin(0.7 * sway) * lerp(0.03 + 0.07 * i, 0.02, m), 0, Math.sin(sway) * lerp(0.03 + 0.1 * i, 0.02, m))
      const amp = lerp(3 + 4.5 * i, 3.5, m) * (1 + lerp(0.15 + 0.25 * i, 0.08, m) * input.pulse)
      const k = 1 - Math.exp(-dt / FADE_SEC)
      for (let n = 0; n < MAX_BARS; n++) {
        vis[n] += ((rank[n] < fraction ? 1 : 0) - vis[n]) * k
        const a = n * STEP
        const wave = 0.5 + 0.25 * Math.sin(0.9 * t + 5 * a) + 0.25 * Math.sin(freq[n] * t + phase[n])
        const h = amp * (0.25 + 0.75 * bandAt(a, bass, mid, treble) * (0.4 + 0.6 * wave)) * vis[n]
        const angle = a + spin
        dummy.position.set((R + DEPTH / 2) * Math.sin(angle), 0, -(R + DEPTH / 2) * Math.cos(angle))
        dummy.rotation.set(0, -angle, 0)
        dummy.scale.set(WIDTH * vis[n], h, DEPTH)
        dummy.updateMatrix()
        bars.setMatrixAt(n, dummy.matrix)
      }
      bars.instanceMatrix.needsUpdate = true
      const lit = (x: number) => 0.2 + 0.25 * x
      // Lugnt läge: dämpat men synligt i vila, och i en paus aldrig ljusare än samma procent när passet går.
      const calmGlow = Math.min(0.4, lit(input.runIntensity))
      const glow = lerp(lit(i), calmGlow, m) * (1 + 0.6 * input.pulse)
      material.color.copy(base).multiplyScalar(glow)
    },
    setParticles(f) {
      fraction = f
      if (!seeded) {
        // Första anropet kommer när scenen skapas, under toningen från mörker: sätt direkt.
        seeded = true
        for (let n = 0; n < MAX_BARS; n++) vis[n] = rank[n] < f ? 1 : 0
      }
    },
    dispose() {
      geometry.dispose()
      material.dispose()
      bars.dispose()
    },
  }
}

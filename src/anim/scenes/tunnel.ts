import * as THREE from 'three'
import type { SceneFactory } from './scene'

const MAX_RINGS = 32
const DEPTH = 80 // tunnelns längd; ringarna börjar om längst bort, i dimman

// Kameran flyger genom sexkantiga ringar. Farten och vridningen följer intensiteten, ringarna tänds på pulsen.
export const tunnel: SceneFactory = () => {
  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(0x000000, 6, DEPTH)
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 200)
  const geometry = new THREE.TorusGeometry(3, 0.035, 4, 6)
  const material = new THREE.MeshBasicMaterial()
  const rings = new THREE.InstancedMesh(geometry, material, MAX_RINGS)
  rings.frustumCulled = false // ringarna flyttas varje bildruta, så den beräknade gränsen stämmer aldrig
  scene.add(rings)
  const dummy = new THREE.Object3D()
  let count = MAX_RINGS
  let travel = 0
  let roll = 0

  return {
    scene,
    camera,
    update(input) {
      const m = input.calmMix
      travel += THREE.MathUtils.lerp(6 + 30 * input.intensity, 3, m) * input.dtSec
      roll += THREE.MathUtils.lerp(0.1 + 0.9 * input.intensity, 0.05, m) * input.dtSec
      camera.rotation.z = roll
      const spacing = DEPTH / count
      const twist = 0.08 + 0.25 * input.intensity
      for (let i = 0; i < count; i++) {
        const along = (((i * spacing - travel) % DEPTH) + DEPTH) % DEPTH
        dummy.position.set(0, 0, -along)
        dummy.rotation.set(0, 0, i * twist)
        dummy.scale.setScalar(1 + 0.15 * input.bands.bass)
        dummy.updateMatrix()
        rings.setMatrixAt(i, dummy.matrix)
      }
      rings.instanceMatrix.needsUpdate = true
      const lit = (i: number) => 0.3 + 0.2 * i
      // Lugnt läge: dämpat men synligt i vila, och i en paus aldrig ljusare än samma procent när passet går.
      const calmGlow = input.runIntensity === null ? 0.7 : Math.min(0.7, lit(input.runIntensity))
      const glow = THREE.MathUtils.lerp(lit(input.intensity), calmGlow, m) * (1 + 0.6 * input.pulse)
      material.color.set(input.color).multiplyScalar(glow)
    },
    setParticles(fraction) {
      count = Math.max(8, Math.round(MAX_RINGS * fraction))
      rings.count = count
    },
    dispose() {
      geometry.dispose()
      material.dispose()
      rings.dispose()
    },
  }
}

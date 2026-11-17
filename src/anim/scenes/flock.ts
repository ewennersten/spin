import * as THREE from 'three'
import type { SceneFactory } from './scene'

export const MAX_BIRDS = 400
const MIN_BIRDS = 80
const SPACE = 9 // flocken hålls inom ett klot med den här radien
const SEE = 4.5 // så långt en fågel ser sina grannar
const NEAR = 0.9 // närmare än så håller fåglarna isär
const lerp = THREE.MathUtils.lerp

// Varje fågel är ett streck från huvudet bakåt längs farten. aEnd är 0 vid huvudet och 1 vid stjärten, som tonar ut.
const VERTEX = `attribute float aEnd;
varying float vEnd;
void main() {
  vEnd = aEnd;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const FRAGMENT = `uniform vec3 uColor; uniform float uGlow;
varying float vEnd;
void main() { gl_FragColor = vec4(uColor * (uGlow * (1.0 - 0.85 * vEnd)), 1.0); }`

// En flock lysande streck som flyger tillsammans: varje fågel håller avstånd till de närmaste, flyger åt samma håll
// som grannarna och dras mot dem. Farten följer intensiteten, och på pulsen sprids flocken och samlas igen.
// Idén kommer från fågelflocken bland three.js exempel (Craig Reynolds regler för flockar).
export const flock: SceneFactory = () => {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 200)
  const pos = new Float32Array(MAX_BIRDS * 3)
  const vel = new Float32Array(MAX_BIRDS * 3)
  for (let n = 0; n < MAX_BIRDS; n++) {
    const v = new THREE.Vector3().randomDirection()
    pos.set(v.clone().multiplyScalar(SPACE * Math.cbrt(Math.random())).toArray(), n * 3)
    vel.set(new THREE.Vector3().randomDirection().multiplyScalar(3).toArray(), n * 3)
  }
  const lines = new Float32Array(MAX_BIRDS * 6)
  const ends = new Float32Array(MAX_BIRDS * 2)
  for (let n = 0; n < MAX_BIRDS; n++) ends[n * 2 + 1] = 1
  const geometry = new THREE.BufferGeometry()
  const linePos = new THREE.BufferAttribute(lines, 3)
  linePos.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', linePos)
  geometry.setAttribute('aEnd', new THREE.BufferAttribute(ends, 1))
  const uniforms = { uColor: { value: new THREE.Color() }, uGlow: { value: 0 } }
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT,
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false,
  })
  const birds = new THREE.LineSegments(geometry, material)
  birds.frustumCulled = false // fåglarna flyttas varje bildruta
  scene.add(birds)
  let active = MAX_BIRDS
  geometry.setDrawRange(0, active * 2)
  let orbit = 0
  let color = ''

  return {
    scene,
    camera,
    update(input) {
      const m = input.calmMix
      const i = input.intensity
      if (input.color !== color) {
        color = input.color
        uniforms.uColor.value.set(color)
      }
      const dt = Math.min(input.dtSec, 0.05) // en dold flik eller ett ryck ska inte kasta iväg flocken
      const speed = lerp(3 + 9 * i, 2, m)
      const scatter = lerp(14, 4, m) * input.pulse
      for (let a = 0; a < active; a++) {
        const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2]
        let sx = 0, sy = 0, sz = 0, vx = 0, vy = 0, vz = 0, cx = 0, cy = 0, cz = 0, seen = 0
        for (let b = 0; b < active; b++) {
          if (b === a) continue
          const dx = pos[b * 3] - ax, dy = pos[b * 3 + 1] - ay, dz = pos[b * 3 + 2] - az
          const d2 = dx * dx + dy * dy + dz * dz
          if (d2 > SEE * SEE) continue
          seen++
          vx += vel[b * 3]; vy += vel[b * 3 + 1]; vz += vel[b * 3 + 2]
          cx += dx; cy += dy; cz += dz
          if (d2 < NEAR * NEAR) { const k = 1 / Math.max(d2, 0.01); sx -= dx * k; sy -= dy * k; sz -= dz * k }
        }
        let fx = 1.5 * sx, fy = 1.5 * sy, fz = 1.5 * sz
        if (seen) {
          fx += 1.2 * (vx / seen - vel[a * 3]) + 0.8 * cx / seen
          fy += 1.2 * (vy / seen - vel[a * 3 + 1]) + 0.8 * cy / seen
          fz += 1.2 * (vz / seen - vel[a * 3 + 2]) + 0.8 * cz / seen
        }
        // Alla dras svagt mot mitten, så att småflockarna blir en enda stor; utanför klotet vänder de hem.
        // På pulsen skjuts de utåt från mitten.
        const r = Math.hypot(ax, ay, az) || 1
        const home = 0.25 * r + (r > SPACE ? (r - SPACE) * 2 : 0)
        fx += (scatter - home) * ax / r
        fy += (scatter - home) * ay / r
        fz += (scatter - home) * az / r
        let nx = vel[a * 3] + fx * dt, ny = vel[a * 3 + 1] + fy * dt, nz = vel[a * 3 + 2] + fz * dt
        // Farten dras mot målfarten, så att flocken varken stannar eller rusar.
        const s = Math.hypot(nx, ny, nz) || 1
        const k = lerp(s, speed, 0.05) / s
        nx *= k; ny *= k; nz *= k
        vel[a * 3] = nx; vel[a * 3 + 1] = ny; vel[a * 3 + 2] = nz
      }
      const tail = lerp(0.35 + 0.08 * speed, 0.3, m)
      for (let a = 0; a < active; a++) {
        const o = a * 3
        pos[o] += vel[o] * dt; pos[o + 1] += vel[o + 1] * dt; pos[o + 2] += vel[o + 2] * dt
        const s = Math.hypot(vel[o], vel[o + 1], vel[o + 2]) || 1
        lines.set([pos[o], pos[o + 1], pos[o + 2], pos[o] - vel[o] / s * tail, pos[o + 1] - vel[o + 1] / s * tail, pos[o + 2] - vel[o + 2] / s * tail], a * 6)
      }
      linePos.needsUpdate = true
      // Kameran glider långsamt runt flocken.
      orbit += lerp(0.06 + 0.12 * i, 0.03, m) * input.dtSec
      camera.position.set(20 * Math.sin(orbit), 3 * Math.sin(0.5 * orbit), 20 * Math.cos(orbit))
      camera.lookAt(0, 0, 0)
      const lit = (x: number) => 0.6 + 0.6 * x
      // Lugnt läge: dämpat men synligt i vila, och i en paus aldrig ljusare än samma procent när passet går.
      const calmGlow = Math.min(1.2, lit(input.runIntensity))
      uniforms.uGlow.value = lerp(lit(i), calmGlow, m) * (1 + 0.5 * input.pulse)
    },
    setParticles(fraction) {
      active = Math.max(MIN_BIRDS, Math.round(MAX_BIRDS * fraction))
      geometry.setDrawRange(0, active * 2)
    },
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}

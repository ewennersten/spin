import * as THREE from 'three'
import type { SceneFactory } from './scene'

export const MAX_BIRDS = 400
const MIN_BIRDS = 80
const SPACE = 6 // flocken hålls inom ett klot med den här radien kring ledaren
const HOME = 0.15 // hur hårt fåglarna dras mot ledaren
const SEE = 4.5 // så långt en fågel ser sina grannar
const NEAR = 1.8 // närmare än så håller fåglarna isär
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

// Ledaren flyger i en åtta genom bilden, så att flocken sveper fram och tillbaka och sträcks ut i svängarna.
const LEAD_X = 10
const LEAD_Y = 5
const LEAD_Z = 5
function leaderAt(phase: number, out: THREE.Vector3): THREE.Vector3 {
  return out.set(LEAD_X * Math.sin(phase), LEAD_Y * Math.sin(2 * phase), LEAD_Z * Math.cos(phase))
}

// En flock lysande streck som flyger tillsammans: varje fågel håller avstånd till de närmaste, flyger åt samma håll
// som grannarna och dras mot dem. Alla dras mot en osynlig ledare som flyger i åttor, och farten följer intensiteten.
// På pulsen sprids flocken från ledaren och samlas igen.
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
  let phase = 0
  const lead = new THREE.Vector3()
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
      // Ledaren går fortare vid hög intensitet; ett varv i åttan tar ungefär 25 s i vila och 8 s på max.
      phase += lerp(0.35 + 0.45 * i, 0.25, m) * dt
      leaderAt(phase, lead)
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
        // Alla dras mot ledaren, så att småflockarna blir en enda stor som följer den; långt efter skyndar de ikapp.
        // På pulsen skjuts de utåt från ledaren.
        const lx = ax - lead.x, ly = ay - lead.y, lz = az - lead.z
        const r = Math.hypot(lx, ly, lz) || 1
        const home = HOME * r + (r > SPACE ? (r - SPACE) * 2 : 0)
        fx += (scatter - home) * lx / r
        fy += (scatter - home) * ly / r
        fz += (scatter - home) * lz / r
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
      // Kameran står framför åttan och gungar lätt, så att svepet alltid går tvärs över bilden.
      orbit += lerp(0.06 + 0.12 * i, 0.03, m) * input.dtSec
      camera.position.set(4 * Math.sin(orbit), 2 * Math.sin(0.5 * orbit), 22)
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

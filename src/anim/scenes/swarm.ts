import * as THREE from 'three'
import type { SceneFactory } from './scene'

export const MAX_PARTICLES = 6000
const CENTER = 12 // virvelns mitt ligger så här långt framför kameran
const R_IN = 2
const R_OUT = 21 // räcker ut till bildens kanter: 21 enheter i sidled på 12 enheters avstånd är utanför bild
const ARMS = 4
const TWIST = 0.18 // armarnas vridning per enhet ut från mitten
const HALO = 0.2 // andelen partiklar i ett moln runt virveln
const FEATHER = 0.02 // partiklarna vid gränsen för de synliga tonas in och ut över 2 % av alla
const lerp = THREE.MathUtils.lerp

// Läget räknas i shadern. position × radie är läget från virvelns mitt; aParams är radie, frö, rang och storlek.
const VERTEX = `attribute vec4 aParams;
uniform float uSpin; uniform float uTumble; uniform float uPush; uniform float uWobble; uniform float uTime;
uniform float uCut; uniform float uSize; uniform float uHeight;
varying float vFade; varying float vTint;
vec2 rot(vec2 v, float a) { float c = cos(a); float s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }
void main() {
  float r = aParams.x;
  float seed = aParams.y;
  vec3 p = position;
  p.xy = rot(p.xy, uSpin);
  // Virveln gungar men vänds aldrig på kant, så att den alltid täcker bilden ut till kanterna.
  p.yz = rot(p.yz, 0.35 * sin(uTumble));
  p.xz = rot(p.xz, 0.25 * sin(0.7 * uTumble + 1.0));
  vec3 phase = seed * vec3(6.2832, 17.0, 29.0) + uTime * (1.5 + 2.0 * fract(seed * 7.0)) * vec3(1.0, 0.8, 1.3);
  vec3 world = p * r * (1.0 + uPush) + uWobble * sin(phase);
  vec4 mv = modelViewMatrix * vec4(world + vec3(0.0, 0.0, -${CENTER}.0), 1.0);
  gl_Position = projectionMatrix * mv;
  float dist = -mv.z;
  vFade = clamp((uCut - aParams.z) / ${FEATHER}, 0.0, 1.0) * smoothstep(1.5, 5.0, dist) * (1.0 - smoothstep(28.0, 36.0, dist));
  vTint = 0.45 + 0.55 * fract(seed * 13.0);
  // Storleken i bildpunkter följer buffertens höjd, så att punkterna är lika stora i bild på alla kvalitetsnivåer.
  gl_PointSize = vFade > 0.0 ? min(uSize * aParams.w * uHeight * 0.5 * projectionMatrix[1][1] / dist, 0.03 * uHeight) : 0.0;
}`

const FRAGMENT = `uniform vec3 uColor; uniform float uGlow;
varying float vFade; varying float vTint;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  float a = (1.0 - d) * (1.0 - d);
  gl_FragColor = vec4(uColor * (uGlow * vTint * vFade * a), 1.0);
}`

// Tusentals lysande punkter virvlar runt en mitt framför kameran, trycks utåt på varje puls och dras tillbaka.
export const swarm: SceneFactory = () => {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 200)
  const dirs = new Float32Array(MAX_PARTICLES * 3)
  const params = new Float32Array(MAX_PARTICLES * 4)
  for (let n = 0; n < MAX_PARTICLES; n++) {
    // Fler ytterst, så att virveln syns längs bildens kanter och inte bara mitt i bild.
    const r = R_IN + (R_OUT - R_IN) * Math.sqrt(Math.random())
    if (Math.random() < HALO) {
      const z = 2 * Math.random() - 1
      const phi = 2 * Math.PI * Math.random()
      const s = Math.sqrt(1 - z * z)
      dirs.set([s * Math.cos(phi), s * Math.sin(phi), z], n * 3)
    } else {
      const theta = (2 * Math.PI * Math.floor(Math.random() * ARMS)) / ARMS + r * TWIST + 0.5 * (Math.random() + Math.random() - 1)
      dirs.set([Math.cos(theta), Math.sin(theta), 0.25 * (Math.random() - 0.5)], n * 3)
    }
    params.set([r, Math.random(), n / MAX_PARTICLES, 0.6 + 0.8 * Math.random()], n * 4)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(dirs, 3))
  geometry.setAttribute('aParams', new THREE.BufferAttribute(params, 4))
  geometry.setDrawRange(0, MAX_PARTICLES)
  const uniforms = {
    uSpin: { value: 0 }, uTumble: { value: 0 }, uPush: { value: 0 }, uWobble: { value: 0 }, uTime: { value: 0 },
    uCut: { value: 0 }, uSize: { value: 0.4 }, uHeight: { value: 1080 }, uColor: { value: new THREE.Color() }, uGlow: { value: 0 },
  }
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT,
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false,
  })
  const points = new THREE.Points(geometry, material)
  points.frustumCulled = false // lägena räknas i shadern, så den beräknade gränsen stämmer aldrig
  points.onBeforeRender = renderer => {
    uniforms.uHeight.value = renderer.getRenderTarget()?.height ?? renderer.domElement.height
  }
  scene.add(points)
  let available = MAX_PARTICLES
  let spin = 0
  let tumble = 0
  let color = ''

  return {
    scene,
    camera,
    update(input) {
      const { bass, mid, treble } = input.bands
      const m = input.calmMix
      const i = input.intensity
      if (input.color !== color) {
        color = input.color
        uniforms.uColor.value.set(color)
      }
      spin += lerp(0.2 + 1.2 * i, 0.05, m) * (0.7 + 0.6 * mid) * input.dtSec
      tumble += lerp(0.15 + 0.35 * i, 0.05, m) * input.dtSec
      uniforms.uSpin.value = spin
      uniforms.uTumble.value = tumble
      uniforms.uPush.value = lerp(0.2 + 0.4 * i, 0.06, m) * input.pulse + lerp(0.12, 0.04, m) * bass
      uniforms.uWobble.value = lerp(0.3 + 0.9 * i, 0.15, m) * treble
      uniforms.uTime.value = input.timeSec
      uniforms.uCut.value = (0.3 + 0.7 * i) * available / MAX_PARTICLES
      const lit = (x: number) => 0.65 + 0.65 * x
      // Lugnt läge: dämpat men synligt i vila, och i en paus aldrig ljusare än samma procent när passet går
      // (i pausen syns dessutom färre partiklar än när passet går, uCut ovan).
      const calmGlow = Math.min(2.5, lit(input.runIntensity))
      uniforms.uGlow.value = lerp(lit(i), calmGlow, m) * (1 + 0.8 * input.pulse)
    },
    setParticles(fraction) {
      available = Math.round(MAX_PARTICLES * fraction)
      geometry.setDrawRange(0, available)
    },
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}

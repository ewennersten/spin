import * as THREE from 'three'
import type { SceneFactory } from './scene'

const RADIUS = 3.4
const DETAIL = 12 // kanter per sida i ikosaedern: glest nog att nätet syns som trådar
const lerp = THREE.MathUtils.lerp

// Brus i tre dimensioner: slumpvärden i ett rutnät, mjukt blandade. Ytan böljer där bruset ändras med tiden.
const NOISE = `float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}`

// Varje hörn flyttas ut eller in längs sin riktning. Samma läge ger samma flytt, så att nätets kanter hänger ihop.
const VERTEX = `uniform float uTime; uniform float uAmp;
varying float vLift;
${NOISE}
void main() {
  vec3 n = normalize(position);
  float k = 0.65 * noise(n * 1.7 + vec3(0.0, 0.0, uTime)) + 0.35 * noise(n * 3.9 - vec3(uTime * 0.7));
  vLift = 2.0 * k - 1.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position * (1.0 + uAmp * vLift), 1.0);
}`

// Topparna lyser mer än dalarna, så att böljorna syns även rakt framifrån.
const FRAGMENT = `uniform vec3 uColor; uniform float uGlow;
varying float vLift;
void main() { gl_FragColor = vec4(uColor * (uGlow * (0.55 + 0.45 * vLift)), 1.0); }`

// Ett klot av lysande trådnät mitt i bild. Ytan böljer långsamt och fortare ju högre intensiteten är,
// buktar ut med basen och slår ut på varje puls. Idén kommer från ljudstyrda brusklot i three.js-världen.
export const klot: SceneFactory = () => {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 200)
  camera.position.z = 9
  const shape = new THREE.IcosahedronGeometry(RADIUS, DETAIL)
  const geometry = new THREE.WireframeGeometry(shape)
  shape.dispose()
  const uniforms = { uTime: { value: 0 }, uAmp: { value: 0 }, uColor: { value: new THREE.Color() }, uGlow: { value: 0 } }
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT,
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false,
  })
  const net = new THREE.LineSegments(geometry, material)
  net.frustumCulled = false // ytan flyttas i shadern, så den beräknade gränsen stämmer inte
  scene.add(net)
  let time = 0
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
      time += lerp(0.15 + 0.6 * i, 0.08, m) * input.dtSec
      uniforms.uTime.value = time
      uniforms.uAmp.value = lerp(0.08 + 0.12 * i, 0.05, m) + lerp(0.1, 0.03, m) * input.bands.bass + lerp(0.25, 0.08, m) * input.pulse
      net.rotation.y += lerp(0.1 + 0.4 * i, 0.05, m) * input.dtSec
      net.rotation.x = 0.35 * Math.sin(0.2 * input.timeSec)
      const lit = (x: number) => 0.35 + 0.35 * x
      // Lugnt läge: dämpat men synligt i vila, och i en paus aldrig ljusare än samma procent när passet går.
      const calmGlow = Math.min(0.8, lit(input.runIntensity))
      uniforms.uGlow.value = lerp(lit(i), calmGlow, m) * (1 + 0.6 * input.pulse)
    },
    // Nätet är några tiotusen linjer, så alla kvalitetsnivåer ritar hela.
    setParticles() {},
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}

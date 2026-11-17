import * as THREE from 'three'
import type { SceneFactory } from './scene'

const SECTORS = 8 // speglade tårtbitar runt mitten
const lerp = THREE.MathUtils.lerp

// Rutan täcker hela bilden; mönstret räknas per bildpunkt.
const VERTEX = `void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`

// Vinkeln speglas i varje tårtbit, och avståndet från mitten räknas logaritmiskt, så att mönstret upprepas
// när det strömmar utåt. Två spiraler som korsar varandra och ringar mellan dem ger ett gallermönster.
const FRAGMENT = `uniform vec2 uRes; uniform float uTravel; uniform float uSpin; uniform float uWidth;
uniform vec3 uColor; uniform float uGlow;
float line(float x, float w) { return smoothstep(w, 0.0, abs(x)); }
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float r = length(p);
  float seg = 6.2831853 / ${SECTORS}.0;
  float a = abs(mod(atan(p.y, p.x) + uSpin, seg) - 0.5 * seg);
  float z = 2.5 * log(max(r, 1e-4)) - uTravel;
  float v = line(fract(z + 3.0 * a) - 0.5, uWidth) + line(fract(z - 3.0 * a) - 0.5, uWidth)
    + 0.6 * line(fract(0.5 * z) - 0.5, 0.7 * uWidth);
  // Mitten tonas bort, där linjerna blir för täta, och kanterna dämpas lite.
  v *= smoothstep(0.03, 0.25, r) * (1.0 - 0.35 * smoothstep(0.6, 1.2, r));
  gl_FragColor = vec4(uColor * (uGlow * v), 1.0);
}`

// Ett kalejdoskop av lysande galler som strömmar ut från mitten och vrider sig sakta. Farten följer intensiteten,
// linjerna blir tjockare med basen och lyser upp på pulsen. Inspirerat av kalejdoskopen på Shadertoy, skrivet från grunden.
export const kalejdoskop: SceneFactory = () => {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 200)
  const geometry = new THREE.PlaneGeometry(2, 2)
  const uniforms = {
    uRes: { value: new THREE.Vector2(1920, 1080) }, uTravel: { value: 0 }, uSpin: { value: 0 }, uWidth: { value: 0.04 },
    uColor: { value: new THREE.Color() }, uGlow: { value: 0 },
  }
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT, depthWrite: false, depthTest: false })
  const quad = new THREE.Mesh(geometry, material)
  quad.frustumCulled = false // rutan ligger alltid över hela bilden, oavsett kameran
  quad.onBeforeRender = renderer => {
    const target = renderer.getRenderTarget()
    uniforms.uRes.value.set(target?.width ?? renderer.domElement.width, target?.height ?? renderer.domElement.height)
  }
  scene.add(quad)
  let travel = 0
  let spin = 0
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
      travel += lerp(0.3 + 1.6 * i, 0.15, m) * input.dtSec
      spin += lerp(0.05 + 0.25 * i, 0.02, m) * input.dtSec
      uniforms.uTravel.value = travel
      uniforms.uSpin.value = spin
      uniforms.uWidth.value = 0.03 + lerp(0.025, 0.008, m) * input.bands.bass
      // Mönstret fyller hela bilden, så det lyser svagare än scenerna med ett föremål mitt i bild.
      const lit = (x: number) => 0.3 + 0.3 * x
      // Lugnt läge: dämpat men synligt i vila, och i en paus aldrig ljusare än samma procent när passet går.
      const calmGlow = Math.min(0.7, lit(input.runIntensity))
      uniforms.uGlow.value = lerp(lit(i), calmGlow, m) * (1 + 0.5 * input.pulse)
    },
    // Mönstret räknas per bildpunkt, och kvalitetsnivån sänker redan upplösningen.
    setParticles() {},
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}

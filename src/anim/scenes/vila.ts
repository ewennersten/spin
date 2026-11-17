import * as THREE from 'three'
import type { SceneFactory } from './scene'

// Viloscenerna (se docs/ideer/viloscener.md). De visas bara i vila: de rör sig långsamt, blinkar aldrig och följer
// inte musiken, så att pulsen kan gå ned. De är gråa, i vilozonens färg (#5F5E5A och #D3D1C7), så att färgen visar
// intensiteten som i resten av appen. De flesta ritas som en ruta över hela bilden där mönstret räknas per bildpunkt.

const COLORS = `const vec3 LIGHT = vec3(0.83, 0.82, 0.78); const vec3 MID = vec3(0.55, 0.54, 0.51); const vec3 PALE = vec3(0.93, 0.92, 0.89);
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hash1(float n) { return fract(sin(n * 91.345) * 47453.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) { float s = 0.0; float a = 0.5; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
`
const HEAD = `uniform vec2 uRes; uniform float uTime; uniform float uGlow;
${COLORS}`
const QUAD_VERTEX = `void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`

// En ruta över hela bilden med ett mönster per bildpunkt. uGlow är ljusstyrkan, uTime tiden i sekunder.
// Grått upplevs ljusare än blått i samma styrka, så scenerna lyser lite svagare än de vanliga.
function quadScene(fragment: string, glow = 0.7): SceneFactory {
  return () => {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 200)
    const geometry = new THREE.PlaneGeometry(2, 2)
    const uniforms = { uRes: { value: new THREE.Vector2(1920, 1080) }, uTime: { value: 0 }, uGlow: { value: glow } }
    const material = new THREE.ShaderMaterial({ uniforms, vertexShader: QUAD_VERTEX, fragmentShader: HEAD + fragment, depthWrite: false, depthTest: false })
    const quad = new THREE.Mesh(geometry, material)
    quad.frustumCulled = false
    quad.onBeforeRender = renderer => {
      const target = renderer.getRenderTarget()
      uniforms.uRes.value.set(target?.width ?? renderer.domElement.width, target?.height ?? renderer.domElement.height)
    }
    scene.add(quad)
    return {
      scene,
      camera,
      update(input) { uniforms.uTime.value = input.timeSec },
      setParticles() {},
      dispose() { geometry.dispose(); material.dispose() },
    }
  }
}

// Lavalampa: mjuka klumpar av ljus som sakta flyter ihop och delar sig igen.
export const lavalampa = quadScene(`
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float f = 0.0;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    vec2 c = vec2(0.6 * sin(uTime * 0.11 + fi * 1.7), 0.36 * sin(uTime * 0.14 + fi * 2.3));
    float r = 0.1 + 0.03 * sin(fi * 2.1);
    vec2 d = p - c;
    f += r * r / (dot(d, d) + 0.0001);
  }
  float body = smoothstep(0.9, 1.15, f);
  float rim = smoothstep(0.55, 0.9, f) * (1.0 - body);
  vec3 tint = mix(MID, LIGHT, clamp(p.y + 0.5, 0.0, 1.0));
  vec3 col = vec3(0.015, 0.015, 0.014) + tint * (body * 0.55 + rim * 0.35);
  gl_FragColor = vec4(col * uGlow, 1.0);
}`)

// Rymdfärd: en långsam glidfärd framåt mellan stjärnorna, förbi ett blått nebulosamoln.
const STARS = 1500
export const rymdfard: SceneFactory = () => {
  const base = quadScene(`
void main() {
  vec2 p = gl_FragCoord.xy / uRes.y;
  float n = fbm(p * 1.8 + vec2(uTime * 0.008, 0.0));
  float m = fbm(p * 3.1 - vec2(0.0, uTime * 0.006));
  vec3 col = MID * 0.32 * smoothstep(0.45, 0.85, n) + LIGHT * 0.14 * smoothstep(0.55, 0.95, m);
  gl_FragColor = vec4(col * uGlow, 1.0);
}`)()
  const positions = new Float32Array(STARS * 3)
  for (let i = 0; i < STARS; i++) positions.set([(Math.random() - 0.5) * 60, (Math.random() - 0.5) * 40, -Math.random() * 120], i * 3)
  const geometry = new THREE.BufferGeometry()
  const attr = new THREE.BufferAttribute(positions, 3)
  attr.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', attr)
  const material = new THREE.PointsMaterial({ color: 0xeeede9, size: 0.18, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false })
  const stars = new THREE.Points(geometry, material)
  stars.frustumCulled = false
  base.scene.add(stars)
  let count = STARS
  return {
    scene: base.scene,
    camera: base.camera,
    update(input) {
      base.update(input)
      const step = 5 * Math.min(input.dtSec, 0.1)
      for (let i = 0; i < count; i++) {
        let z = positions[i * 3 + 2] + step
        if (z > 0) z -= 120
        positions[i * 3 + 2] = z
      }
      attr.needsUpdate = true
    },
    setParticles(fraction) {
      count = Math.max(300, Math.round(STARS * fraction))
      geometry.setDrawRange(0, count)
    },
    dispose() { base.dispose(); geometry.dispose(); material.dispose() },
  }
}

// Discokula: en glittrande kula som snurrar i mitten, och ljusprickar som sveper över väggarna runtomkring.
const DOTS = 500
const DOT_VERTEX = `attribute float aSeed; uniform float uTime; uniform float uHeight; uniform float uSize;
varying float vSeed;
void main() {
  vSeed = aSeed;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * (0.6 + 0.4 * sin(uTime * 0.7 + aSeed * 40.0)) * uHeight / -mv.z;
}`
const DOT_FRAGMENT = `uniform float uGlow; varying float vSeed;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  vec3 c = mix(vec3(0.93, 0.92, 0.89), fract(vSeed * 7.0) > 0.5 ? vec3(0.83, 0.82, 0.78) : vec3(0.55, 0.54, 0.51), smoothstep(0.0, 0.8, d));
  gl_FragColor = vec4(c * uGlow * (1.0 - d) * (1.0 - d), 1.0);
}`
export const discokula: SceneFactory = () => {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 200)
  camera.position.z = 7
  // Ljusprickarna på väggarna: punkter på ett stort klot runt kameran, som snurrar med kulan.
  const dirs = new Float32Array(DOTS * 3)
  const seeds = new Float32Array(DOTS)
  for (let i = 0; i < DOTS; i++) {
    dirs.set(new THREE.Vector3().randomDirection().multiplyScalar(22).toArray(), i * 3)
    seeds[i] = Math.random()
  }
  const dotGeometry = new THREE.BufferGeometry()
  dotGeometry.setAttribute('position', new THREE.BufferAttribute(dirs, 3))
  dotGeometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
  const uniforms = { uTime: { value: 0 }, uHeight: { value: 1080 }, uSize: { value: 0.9 }, uGlow: { value: 0.7 } }
  const dotMaterial = new THREE.ShaderMaterial({ uniforms, vertexShader: DOT_VERTEX, fragmentShader: DOT_FRAGMENT, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false })
  const dots = new THREE.Points(dotGeometry, dotMaterial)
  dots.frustumCulled = false
  dots.onBeforeRender = renderer => { uniforms.uHeight.value = renderer.getRenderTarget()?.height ?? renderer.domElement.height }
  // Kulan: ett nät av speglar och glittrande punkter i hörnen.
  const ballShape = new THREE.IcosahedronGeometry(1.4, 3)
  const ballLines = new THREE.WireframeGeometry(ballShape)
  const lineMaterial = new THREE.LineBasicMaterial({ color: new THREE.Color(0.4, 0.39, 0.37), transparent: true, opacity: 0.8 })
  const ball = new THREE.LineSegments(ballLines, lineMaterial)
  const sparkleGeometry = new THREE.BufferGeometry()
  sparkleGeometry.setAttribute('position', ballShape.getAttribute('position'))
  const sparkleSeeds = new Float32Array(ballShape.getAttribute('position').count).map(() => Math.random())
  sparkleGeometry.setAttribute('aSeed', new THREE.BufferAttribute(sparkleSeeds, 1))
  const sparkleUniforms = { uTime: uniforms.uTime, uHeight: uniforms.uHeight, uSize: { value: 0.12 }, uGlow: { value: 1.2 } }
  const sparkleMaterial = new THREE.ShaderMaterial({ uniforms: sparkleUniforms, vertexShader: DOT_VERTEX, fragmentShader: DOT_FRAGMENT, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })
  const sparkles = new THREE.Points(sparkleGeometry, sparkleMaterial)
  sparkles.onBeforeRender = dots.onBeforeRender
  const group = new THREE.Group()
  group.add(dots, ball, sparkles)
  scene.add(group)
  return {
    scene,
    camera,
    update(input) {
      uniforms.uTime.value = input.timeSec
      group.rotation.y += 0.12 * Math.min(input.dtSec, 0.1)
      group.rotation.x = 0.25 * Math.sin(input.timeSec * 0.05)
    },
    setParticles(fraction) { dotGeometry.setDrawRange(0, Math.max(150, Math.round(DOTS * fraction))) },
    dispose() {
      ballShape.dispose(); ballLines.dispose(); dotGeometry.dispose(); sparkleGeometry.dispose()
      lineMaterial.dispose(); dotMaterial.dispose(); sparkleMaterial.dispose()
    },
  }
}

const LIGHT = new THREE.Color(0.83, 0.82, 0.78)
const MID = new THREE.Color(0.55, 0.54, 0.51)

// Rutnät som andas: ett rutnätsgolv som de vanliga scenerna har, men stilla, med långa mjuka dyningar som rullar sakta.
const GRID = 60
export const rutnat: SceneFactory = () => {
  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(0x000000, 6, 40)
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 200)
  camera.position.set(0, 3.2, 10)
  camera.lookAt(0, 0, -8)
  const n = GRID + 1
  const size = 60
  const positions = new Float32Array(n * n * 3)
  const index: number[] = []
  for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
    positions.set([(x / GRID - 0.5) * size, 0, (z / GRID - 0.5) * size - 15], (z * n + x) * 3)
    if (x < GRID) index.push(z * n + x, z * n + x + 1)
    if (z < GRID) index.push(z * n + x, (z + 1) * n + x)
  }
  const geometry = new THREE.BufferGeometry()
  const attr = new THREE.BufferAttribute(positions, 3)
  attr.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', attr)
  geometry.setIndex(index)
  const material = new THREE.LineBasicMaterial({ color: MID, transparent: true, opacity: 0.85 })
  const lines = new THREE.LineSegments(geometry, material)
  lines.frustumCulled = false
  scene.add(lines)
  return {
    scene,
    camera,
    update(input) {
      const s = input.timeSec
      for (let i = 0; i < n * n; i++) {
        const x = positions[i * 3]
        const z = positions[i * 3 + 2]
        positions[i * 3 + 1] = 0.9 * Math.sin(x * 0.18 + z * 0.22 - s * 0.35) + 0.5 * Math.sin(z * 0.35 - s * 0.25)
      }
      attr.needsUpdate = true
    },
    setParticles() {},
    dispose() { geometry.dispose(); material.dispose() },
  }
}

// Roterande geometri: en kub, en oktaeder och en ikosaeder av tunna linjer inuti varandra, som vrider sig sakta åt olika håll.
export const geometri: SceneFactory = () => {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 200)
  camera.position.z = 4.2 // nära, så att formerna fyller bilden bakom texterna
  const parts = [
    { shape: new THREE.BoxGeometry(2.6, 2.6, 2.6), color: MID, opacity: 0.9, spin: [0.09, 0.07] },
    { shape: new THREE.OctahedronGeometry(2.3), color: LIGHT, opacity: 0.75, spin: [-0.06, 0.1] },
    { shape: new THREE.IcosahedronGeometry(1.45), color: LIGHT, opacity: 1, spin: [0.12, -0.08] },
  ].map(({ shape, color, opacity, spin }) => {
    const edges = new THREE.EdgesGeometry(shape)
    shape.dispose()
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity })
    const mesh = new THREE.LineSegments(edges, material)
    scene.add(mesh)
    return { mesh, edges, material, spin }
  })
  return {
    scene,
    camera,
    update(input) {
      const dt = Math.min(input.dtSec, 0.1)
      for (const p of parts) {
        p.mesh.rotation.y += p.spin[0] * dt
        p.mesh.rotation.x += p.spin[1] * dt
      }
    },
    setParticles() {},
    dispose() { for (const p of parts) { p.edges.dispose(); p.material.dispose() } },
  }
}

// Partikelmoln: lysande punkter i ett moln som svävar sakta runt mitten, som partikelsvärmen fast i vila.
const CLOUD = 3000
export const partikelmoln: SceneFactory = () => {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 200)
  camera.position.z = 9
  // Runda, mjuka punkter med samma ritkod som discokulans prickar, som andas långsamt i storlek.
  const time = { value: 0 }
  const height = { value: 1080 }
  const make = (count: number, size: number, glow: number) => {
    const positions = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(6 * Math.cbrt(Math.random()))
      positions.set([v.x * 1.4, v.y * 0.7, v.z], i * 3)
      seeds[i] = Math.random()
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    const material = new THREE.ShaderMaterial({
      uniforms: { uTime: time, uHeight: height, uSize: { value: size }, uGlow: { value: glow } },
      vertexShader: DOT_VERTEX, fragmentShader: DOT_FRAGMENT, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    })
    const points = new THREE.Points(geometry, material)
    points.onBeforeRender = renderer => { height.value = renderer.getRenderTarget()?.height ?? renderer.domElement.height }
    return { points, geometry, material, count }
  }
  const near = make(Math.round(CLOUD * 0.7), 0.06, 0.8)
  const far = make(Math.round(CLOUD * 0.3), 0.09, 1.1)
  const group = new THREE.Group()
  group.add(near.points, far.points)
  scene.add(group)
  return {
    scene,
    camera,
    update(input) {
      const dt = Math.min(input.dtSec, 0.1)
      time.value = input.timeSec
      group.rotation.y += 0.05 * dt
      group.rotation.x = 0.2 * Math.sin(input.timeSec * 0.04)
      far.points.rotation.y -= 0.03 * dt // de ljusa punkterna glider åt andra hållet
    },
    setParticles(fraction) {
      for (const c of [near, far]) c.geometry.setDrawRange(0, Math.max(200, Math.round(c.count * fraction)))
    },
    dispose() { for (const c of [near, far]) { c.geometry.dispose(); c.material.dispose() } },
  }
}

export const REST_SCENES: SceneFactory[] = [discokula, rymdfard, lavalampa, rutnat, geometri, partikelmoln]

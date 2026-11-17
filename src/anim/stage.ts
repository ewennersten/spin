import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js'
import type { BeatFrame } from '../audio/beatSource'
import { zoneFor } from '../model/zones'
import { BandLevels, BeatPulse, SceneDirector, calmFor, edgeOpacity, follow, intensityFor, shakeAmount } from './drive'
import { LightGovernor } from './governor'
import { QUALITY_LEVELS, QualityController } from './quality'
import { SCENES } from './scenes'
import type { Scene } from './scenes/scene'

export interface StageFrame { pctNow: number; running: boolean; blockIndex: number; beat: BeatFrame; nowMs: number }
export interface StageOptions { forcedScene: number | null; lightMeter: boolean }
// broken: scenen har dolts för resten av vyn (tappad kontext, omätt ljus eller ett fel i frame).
export interface Stage { readonly broken: boolean; frame(f: StageFrame): void; setVisible(on: boolean): void; dispose(): void }

const FADE_MS = 600
const METER_W = 16
const METER_H = 9

const VERTEX = `varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`

const SRGB = `
vec3 toLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 toSrgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }`

// Färgsplittring och vågräta remsor i VO2max. Flyttar bara bildpunkter, ljusstyrkan ändras inte.
const GLITCH = {
  uniforms: { tDiffuse: { value: null }, uOffset: { value: 0 }, uBars: { value: 0 }, uSeed: { value: 0 } },
  vertexShader: VERTEX,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uOffset; uniform float uBars; uniform float uSeed;
varying vec2 vUv;
float hash(float n) { return fract(sin(n * 91.345 + uSeed * 47.13) * 43758.5453); }
void main() {
  vec2 uv = vUv;
  float row = floor(uv.y * 24.0);
  if (uBars > 0.5 && hash(row) > 0.8) uv.x += (hash(row + 7.0) - 0.5) * 0.06;
  vec2 d = vec2(uOffset, 0.0);
  gl_FragColor = vec4(texture2D(tDiffuse, uv + d).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - d).b, 1.0);
}`,
}

// Bilden efter OutputPass är sRGB-kodad. Varje ruta i 16×9 blir medel av relativ luminans (WCAG) över 8×8 prov.
// Varje prov läses mitt i en bildpunkt och avkodas före medelvärdet: en bilinjär blandning i sRGB ger för lågt ljus.
const METER_FRAGMENT = `uniform sampler2D tDiffuse; uniform vec2 uSize; varying vec2 vUv;
${SRGB}
void main() {
  vec2 cell = vec2(1.0 / ${METER_W}.0, 1.0 / ${METER_H}.0);
  vec2 origin = vUv - 0.5 * cell;
  float sum = 0.0;
  for (int y = 0; y < 8; y++) {
    for (int x = 0; x < 8; x++) {
      vec2 p = origin + (vec2(float(x), float(y)) + 0.5) / 8.0 * cell;
      vec3 c = clamp(texture2D(tDiffuse, (floor(p * uSize) + 0.5) / uSize).rgb, 0.0, 1.0);
      sum += dot(toLinear(c), vec3(0.2126, 0.7152, 0.0722));
    }
  }
  gl_FragColor = vec4(vec3(sum / 64.0), 1.0);
}`

// three.js kodar inte om färgerna i en egen ShaderMaterial, så avkodning och kodning sker här.
const FINAL_FRAGMENT = `uniform sampler2D tDiffuse; uniform float uScale; varying vec2 vUv;
${SRGB}
void main() {
  vec3 c = clamp(texture2D(tDiffuse, vUv).rgb, 0.0, 1.0);
  gl_FragColor = vec4(toSrgb(toLinear(c) * uScale), 1.0);
}`

const decimal = (x: number) => x.toFixed(3).replace('.', ',')

export function createStage(options: StageOptions): Stage | null {
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ powerPreference: 'high-performance' })
  } catch {
    return null
  }
  const canvas = renderer.domElement

  const renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera())
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.3, 0.15, 0.1)
  const glitch = new ShaderPass(GLITCH)
  const composer = new EffectComposer(renderer)
  composer.renderToScreen = false // slutpasset nedan ritar till skärmen
  for (const pass of [renderPass, bloom, glitch, new OutputPass()]) composer.addPass(pass)

  const meterTarget = new THREE.WebGLRenderTarget(METER_W, METER_H, { depthBuffer: false })
  const meterMat = new THREE.ShaderMaterial({ uniforms: { tDiffuse: { value: null }, uSize: { value: new THREE.Vector2(1, 1) } }, vertexShader: VERTEX, fragmentShader: METER_FRAGMENT })
  const finalMat = new THREE.ShaderMaterial({ uniforms: { tDiffuse: { value: null }, uScale: { value: 0 } }, vertexShader: VERTEX, fragmentShader: FINAL_FRAGMENT })
  const quad = new FullScreenQuad(meterMat)
  const pixels = new Uint8Array(METER_W * METER_H * 4)

  const root = document.createElement('div')
  root.className = 'stage'
  root.append(canvas)
  const edge = document.createElement('div')
  edge.className = 'edge'
  const meterEl = options.lightMeter ? document.createElement('div') : null
  if (meterEl) meterEl.className = 'light-meter'
  document.body.append(root, edge, ...(meterEl ? [meterEl] : []))

  const forced = options.forcedScene !== null && options.forcedScene >= 0 && options.forcedScene < SCENES.length ? options.forcedScene : null
  const director = new SceneDirector(SCENES.length, Math.random, forced)
  const pulse = new BeatPulse()
  const bands = new BandLevels()
  let governor = new LightGovernor()
  const quality = new QualityController()

  let current: Scene | null = null
  let index = -1
  let level = quality.level
  let fade = 0
  let gain = 1
  let unmeasured = 0
  let intensity = 0
  let calmMix = 1
  let edgeShown = 0
  let visible = true
  let dead = false
  let disposed = false
  let startMs: number | null = null
  let lastMs: number | null = null
  const shake = new THREE.Vector3()

  // Mätrutan: uppmätt ljus × toning × förstärkning, alltså det som faktiskt visades.
  const history: { t: number; v: number }[] = []
  let rise = 0
  let peakShown = 0
  let peakRise = 0
  let meterAt = 0
  let meterFrames = 0

  const applySize = () => {
    const w = innerWidth
    const h = innerHeight
    // Hela bildpunkter genom hela kedjan, så att mätshadern får texturens verkliga storlek (inte t.ex. 1024,5).
    const ratio = Math.min(devicePixelRatio, 1920 / w, 1080 / h) * QUALITY_LEVELS[level].scale
    const pw = Math.max(1, Math.floor(w * ratio))
    const ph = Math.max(1, Math.floor(h * ratio))
    renderer.setPixelRatio(1)
    renderer.setSize(pw, ph, false) // canvasen fyller fönstret via CSS
    composer.setPixelRatio(1)
    composer.setSize(pw, ph)
    if (current) {
      current.camera.aspect = w / h
      current.camera.updateProjectionMatrix()
    }
  }

  const show = (on: boolean) => {
    root.hidden = !on
    edge.hidden = !on
    if (meterEl) meterEl.hidden = !on
  }

  const onLost = () => {
    dead = true
    show(false)
  }

  const record = (t: number, v: number) => {
    history.push({ t, v })
    while (history[0].t < t - 400) history.shift()
    let lo = Infinity
    rise = 0
    for (const s of history) {
      lo = Math.min(lo, s.v)
      rise = Math.max(rise, s.v - lo)
    }
    peakShown = Math.max(peakShown, v)
    peakRise = Math.max(peakRise, rise)
  }

  const swapScene = (want: number) => {
    current?.dispose()
    current = null
    shake.set(0, 0, 0)
    current = SCENES[want]()
    index = want
    current.setParticles(QUALITY_LEVELS[level].particles)
    renderPass.scene = current.scene
    renderPass.camera = current.camera
    current.camera.aspect = innerWidth / innerHeight
    current.camera.updateProjectionMatrix()
  }

  const step = (f: StageFrame) => {
    const first = lastMs === null
    const dtMs = lastMs === null ? 0 : Math.max(0, f.nowMs - lastMs)
    lastMs = f.nowMs
    startMs ??= f.nowMs
    const zone = zoneFor(f.pctNow)
    const calm = calmFor(f.pctNow, f.running)
    if (f.beat.beat) {
      pulse.beat(f.nowMs)
      glitch.uniforms.uSeed.value = Math.random() * 100
    }
    const p = pulse.value(f.nowMs)
    intensity = follow(intensity, calm ? 0 : intensityFor(f.pctNow), dtMs, 1500)
    calmMix = first ? (calm ? 1 : 0) : follow(calmMix, calm ? 1 : 0, dtMs, 800)
    const levels = bands.update(f.beat, f.nowMs, dtMs)
    if (!visible) {
      governor.update(0, dtMs)
      return
    }

    const newLevel = quality.frame(dtMs)
    if (newLevel !== level) {
      level = newLevel
      applySize()
      current?.setParticles(QUALITY_LEVELS[level].particles)
    }

    // Scenbyte genom mörker. Glappet räknas som högst 100 ms, så att en dold flik inte tonar upp på en gång.
    const want = director.pick(f.blockIndex, f.nowMs)
    const fadeStep = Math.min(dtMs, 100) / FADE_MS
    if (want !== index) {
      fade = Math.max(0, fade - fadeStep)
      if (fade === 0) swapScene(want)
    } else {
      fade = Math.min(1, fade + fadeStep)
    }
    if (!current) return

    const camera = current.camera
    camera.position.sub(shake)
    current.update({
      intensity,
      pulse: p,
      bands: levels,
      color: zone.color,
      calm,
      calmMix,
      timeSec: (f.nowMs - startMs) / 1000,
      dtSec: Math.min(dtMs, 100) / 1000,
    })
    shake.randomDirection().multiplyScalar(shakeAmount(intensity) * 0.05 * p)
    camera.position.add(shake)

    bloom.strength = (0.3 + 1.2 * intensity) * (1 - 0.5 * calmMix)
    glitch.enabled = !calm && zone.name === 'VO2max'
    glitch.uniforms.uOffset.value = 0.002 + 0.006 * p
    glitch.uniforms.uBars.value = p > 0.6 ? 1 : 0

    composer.render(dtMs / 1000)
    const image = composer.readBuffer.texture
    meterMat.uniforms.tDiffuse.value = image
    meterMat.uniforms.uSize.value.set(composer.readBuffer.width, composer.readBuffer.height)
    quad.material = meterMat
    renderer.setRenderTarget(meterTarget)
    // Rensa med alfa 0: bara mätshaderns egen utdata ger alfa 255, så ett mätprogram som inte ritar märks nedan.
    const clearAlpha = renderer.getClearAlpha()
    renderer.setClearAlpha(0)
    quad.render(renderer)
    renderer.setClearAlpha(clearAlpha)
    // Synkron läsning av just den här bilden innan den visas. En asynkron läsning kom 1 till 3 bildrutor
    // efter bilden, och slagpulsen hann då ta ljuset till 0,265 och stigningen till 0,135 (uppmätt).
    // Mätshadern skriver alfa 1; står det inte 255 efter läsningen är bildrutan omätt.
    pixels.fill(0)
    let ok = true
    try {
      renderer.readRenderTargetPixels(meterTarget, 0, 0, METER_W, METER_H, pixels)
    } catch {
      ok = false
    }
    let sum = 0
    for (let i = 0; i < pixels.length; i += 4) {
      sum += pixels[i]
      if (pixels[i + 3] !== 255) ok = false
    }
    const measured = sum / 255 / (METER_W * METER_H)
    if (ok) {
      unmeasured = 0
      gain = governor.update(measured * fade, dtMs)
    } else if (++unmeasured >= 3) {
      // Utan mätning finns ingen spärr: dölj för resten av vyn, som vid tappad kontext.
      onLost()
      return
    }
    const scale = fade * gain
    finalMat.uniforms.tDiffuse.value = image
    finalMat.uniforms.uScale.value = scale
    quad.material = finalMat
    renderer.setRenderTarget(null)
    quad.render(renderer)
    if (meterEl && ok) record(f.nowMs, measured * scale)

    // Lugn i vila och paus, följer bildens toning, och tänds mjukt (tau 150 ms, kortare än pulsens 250 ms).
    edgeShown = follow(edgeShown, edgeOpacity(f.pctNow, p) * (1 - calmMix) * fade, dtMs, 150)
    edge.style.opacity = String(edgeShown)
    edge.style.color = zone.color

    if (meterEl) {
      meterFrames++
      if (f.nowMs - meterAt >= 250) {
        const fps = meterAt === 0 ? 0 : meterFrames * 1000 / (f.nowMs - meterAt)
        const shown = history.length ? history[history.length - 1].v : 0
        meterEl.textContent = `Ljus ${decimal(shown)} (högst ${decimal(peakShown)})\n`
          + `Stigning 400 ms ${decimal(rise)} (högst ${decimal(peakRise)})\n`
          + `${Math.round(fps)} bilder/s · nivå ${level}`
        meterAt = f.nowMs
        meterFrames = 0
      }
    }
  }

  applySize()
  addEventListener('resize', applySize)
  canvas.addEventListener('webglcontextlost', onLost)

  return {
    get broken() { return dead },
    frame(f) {
      if (dead) return
      try {
        step(f)
      } catch (e) {
        console.error('Animationerna stängdes av:', e)
        dead = true
        show(false)
      }
    },
    setVisible(on) {
      if (!on) {
        // Bilden tonar alltid upp från svart under spärren när den visas igen, även utan frame under tiden.
        fade = 0
        governor = new LightGovernor()
      } else if (!visible) {
        lastMs = null // första bildrutan efter visningen räknar inget glapp
      }
      visible = on
      show(on && !dead)
      if (!on) {
        edgeShown = 0
        edge.style.opacity = '0'
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      dead = true
      removeEventListener('resize', applySize)
      canvas.removeEventListener('webglcontextlost', onLost)
      root.remove()
      edge.remove()
      meterEl?.remove()
      try {
        current?.dispose()
        for (const pass of composer.passes) pass.dispose()
        composer.dispose()
        meterTarget.dispose()
        meterMat.dispose()
        finalMat.dispose()
        quad.dispose()
        renderer.dispose()
      } catch (e) {
        console.error(e)
      }
      try {
        if (!renderer.getContext().isContextLost()) renderer.forceContextLoss()
      } catch (e) {
        console.error(e)
      }
    },
  }
}

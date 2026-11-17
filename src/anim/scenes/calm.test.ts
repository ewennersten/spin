import type * as THREE from 'three'
import { expect, it } from 'vitest'
import { NO_CAP, calmCap, follow, intensityFor } from '../drive'
import { SCENES } from '.'
import type { Scene } from './scene'

const base = { pulse: 0, bands: { bass: 0.5, mid: 0.5, treble: 0.5 }, color: '#ffffff', timeSec: 1, dtSec: 0.016 }
// Glöden: uGlow i Partikelsvärmen, annars materialets färg (vitt × glöd).
const glow = (s: Scene) => {
  const material = (s.scene.children[0] as THREE.Mesh).material as THREE.ShaderMaterial & THREE.MeshBasicMaterial
  return material.uniforms ? material.uniforms.uGlow.value as number : material.color.r
}

it('lugnt läge: paus är aldrig ljusare än samma procent när passet går, och vilan har inget tak', () => {
  for (const make of SCENES) {
    const s = make()
    for (let pct = 60; pct <= 120; pct += 2) {
      const i = intensityFor(pct)
      s.update({ ...base, intensity: i, calm: false, calmMix: 0, runIntensity: i })
      const running = glow(s)
      s.update({ ...base, intensity: 0, calm: true, calmMix: 1, runIntensity: i })
      expect(glow(s)).toBeLessThanOrEqual(running + 1e-9)
    }
    s.update({ ...base, intensity: 0, calm: true, calmMix: 1, runIntensity: NO_CAP + 10 })
    const rest = glow(s)
    s.update({ ...base, intensity: 0, calm: true, calmMix: 1, runIntensity: NO_CAP })
    expect(glow(s)).toBe(rest) // NO_CAP räcker för att taket inte når ned till vilans glöd
    expect(rest).toBeGreaterThan(0)
    s.dispose()
  }
})

it('lugnt läge: glöden rycker inte när passet går från vila till 61 %', () => {
  for (const make of SCENES) {
    const s = make()
    // Som stage.ts: i vila i flera sekunder, sedan 61 % med 16 ms mellan bildrutorna.
    let cap = calmCap(null, 55, 0)
    let calmMix = 1
    let intensity = 0
    for (let t = 0; t < 3000; t += 16) cap = calmCap(cap, 55, 16)
    s.update({ ...base, intensity, calm: true, calmMix, runIntensity: cap })
    let prev = glow(s)
    const start = prev
    for (let t = 0; t < 3000; t += 16) {
      cap = calmCap(cap, 61, 16)
      calmMix = follow(calmMix, 0, 16, 800)
      intensity = follow(intensity, intensityFor(61), 16, 1500)
      s.update({ ...base, intensity, calm: false, calmMix, runIntensity: cap })
      const now = glow(s)
      expect(Math.abs(now - prev)).toBeLessThan(0.05 * start) // högst 5 % av vilans glöd per bildruta
      prev = now
    }
    s.dispose()
  }
})

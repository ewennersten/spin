import type * as THREE from 'three'
import { expect, it } from 'vitest'
import { intensityFor } from '../drive'
import { SCENES } from '.'
import type { Scene } from './scene'

const base = { pulse: 0, bands: { bass: 0.5, mid: 0.5, treble: 0.5 }, color: '#ffffff', timeSec: 1, dtSec: 0.016 }
// Glöden: uGlow i Partikelsvärmen, annars materialets färg (vitt × glöd).
const glow = (s: Scene) => {
  const material = (s.scene.children[0] as THREE.Mesh).material as THREE.ShaderMaterial & THREE.MeshBasicMaterial
  return material.uniforms ? material.uniforms.uGlow.value as number : material.color.r
}

it('lugnt läge: paus är aldrig ljusare än samma procent när passet går, och vilan är inte svart', () => {
  for (const make of SCENES) {
    const s = make()
    for (let pct = 60; pct <= 120; pct += 2) {
      const i = intensityFor(pct)
      s.update({ ...base, intensity: i, calm: false, calmMix: 0, runIntensity: i })
      const running = glow(s)
      s.update({ ...base, intensity: 0, calm: true, calmMix: 1, runIntensity: i })
      expect(glow(s)).toBeLessThanOrEqual(running + 1e-9)
    }
    s.update({ ...base, intensity: 0, calm: true, calmMix: 1, runIntensity: null })
    expect(glow(s)).toBeGreaterThan(0)
    s.dispose()
  }
})

import type * as THREE from 'three'
import { expect, it } from 'vitest'
import { MAX_PARTICLES, swarm } from './swarm'

const input = { intensity: 1, pulse: 1, bands: { bass: 1, mid: 1, treble: 1 }, color: '#ff0000', calm: false, calmMix: 0, runIntensity: 1, timeSec: 1, dtSec: 0.016 }
const points = (s: ReturnType<typeof swarm>) => s.scene.children[0] as THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>
const uniform = (s: ReturnType<typeof swarm>, name: string) => points(s).material.uniforms[name].value as number

it('partikelsvärmen: antalet följer setParticles, och de synliga följer intensiteten', () => {
  const s = swarm()
  expect(points(s).geometry.drawRange.count).toBe(MAX_PARTICLES)
  s.setParticles(0.35)
  expect(points(s).geometry.drawRange.count).toBe(Math.round(MAX_PARTICLES * 0.35))
  s.update({ ...input, intensity: 0 })
  expect(uniform(s, 'uCut')).toBeCloseTo(0.3 * 0.35)
  s.update({ ...input, intensity: 1 })
  expect(uniform(s, 'uCut')).toBeCloseTo(0.35)
  s.dispose()
})

it('partikelsvärmen: pulsen trycker utåt, och ljuset följer inte ljudbanden', () => {
  const s = swarm()
  s.update({ ...input, pulse: 0 })
  const still = uniform(s, 'uPush')
  const dark = uniform(s, 'uGlow')
  s.update(input)
  expect(uniform(s, 'uPush')).toBeGreaterThan(still)
  const glow = uniform(s, 'uGlow')
  expect(glow).toBeGreaterThan(dark)
  s.update({ ...input, bands: { bass: 0, mid: 0, treble: 0 } })
  expect(uniform(s, 'uGlow')).toBe(glow)
  s.dispose()
})

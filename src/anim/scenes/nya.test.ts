import type * as THREE from 'three'
import { expect, it } from 'vitest'
import { MAX_BIRDS, flock } from './flock'
import { kalejdoskop } from './kalejdoskop'
import { klot } from './klot'

const input = { intensity: 1, pulse: 0, bands: { bass: 0.5, mid: 0.5, treble: 0.5 }, color: '#ff0000', calm: false, calmMix: 0, runIntensity: 1, timeSec: 1, dtSec: 0.016 }
type Shaded = THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>
const uniform = (s: { scene: THREE.Scene }, name: string) => (s.scene.children[0] as Shaded).material.uniforms[name].value as number

it('klotet: pulsen buktar ut ytan, och ljuset följer inte ljudbanden', () => {
  const s = klot()
  s.update(input)
  const still = uniform(s, 'uAmp')
  const glow = uniform(s, 'uGlow')
  s.update({ ...input, pulse: 1 })
  expect(uniform(s, 'uAmp')).toBeGreaterThan(still)
  s.update({ ...input, bands: { bass: 0, mid: 0, treble: 0 } })
  expect(uniform(s, 'uGlow')).toBe(glow)
  s.dispose()
})

it('flocken: antalet följer setParticles, och fåglarna flyger fortare vid hög intensitet', () => {
  const speed = (intensity: number) => {
    const s = flock()
    const geometry = (s.scene.children[0] as Shaded).geometry
    const heads = () => { const a = geometry.attributes.position.array; return Array.from({ length: MAX_BIRDS }, (_, n) => [a[n * 6], a[n * 6 + 1], a[n * 6 + 2]]) }
    for (let f = 0; f < 200; f++) s.update({ ...input, intensity })
    const before = heads()
    s.update({ ...input, intensity })
    const moved = heads().reduce((sum, h, n) => sum + Math.hypot(h[0] - before[n][0], h[1] - before[n][1], h[2] - before[n][2]), 0)
    s.setParticles(0.5)
    expect(geometry.drawRange.count).toBe(MAX_BIRDS * 0.5 * 2) // två hörn per fågel
    s.dispose()
    return moved / MAX_BIRDS / input.dtSec
  }
  const slow = speed(0)
  const fast = speed(1)
  expect(slow).toBeGreaterThan(2)
  expect(fast).toBeGreaterThan(slow * 2)
})

it('flocken: följer ledaren i åttan från ena sidan av bilden till den andra', () => {
  const s = flock()
  const a = (s.scene.children[0] as Shaded).geometry.attributes.position.array
  const centerX = () => { let x = 0; for (let n = 0; n < MAX_BIRDS; n++) x += a[n * 6]; return x / MAX_BIRDS }
  let min = Infinity, max = -Infinity
  // 20 s vid medelhög intensitet hinner mer än ett varv i åttan.
  for (let f = 0; f < 1250; f++) {
    s.update({ ...input, intensity: 0.5 })
    if (f > 200) { min = Math.min(min, centerX()); max = Math.max(max, centerX()) }
  }
  expect(min).toBeLessThan(-5)
  expect(max).toBeGreaterThan(5)
  s.dispose()
})

it('kalejdoskopet: strömmar fortare vid hög intensitet', () => {
  const travel = (intensity: number) => {
    const s = kalejdoskop()
    for (let f = 0; f < 60; f++) s.update({ ...input, intensity })
    const t = uniform(s, 'uTravel')
    s.dispose()
    return t
  }
  expect(travel(1)).toBeGreaterThan(travel(0) * 3)
})

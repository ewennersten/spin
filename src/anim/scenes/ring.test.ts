import * as THREE from 'three'
import { expect, it } from 'vitest'
import { MAX_BARS, bandAt, ring } from './ring'

const input = { intensity: 1, pulse: 1, bands: { bass: 1, mid: 1, treble: 1 }, color: '#ff0000', calm: false, calmMix: 0, timeSec: 1, dtSec: 0.016 }
const bars = (s: ReturnType<typeof ring>) => s.scene.children[0] as THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>
const m = new THREE.Matrix4()
// Staplarna vrids bara runt y, så matrisens element 5 är höjden.
const heights = (s: ReturnType<typeof ring>) => Array.from({ length: MAX_BARS }, (_, n) => (bars(s).getMatrixAt(n, m), m.elements[5]))

it('spektrumringen: basen på ena sidan, diskanten mitt emot', () => {
  expect(bandAt(0, 1, 0, 0)).toBeGreaterThan(bandAt(Math.PI, 1, 0, 0))
  expect(bandAt(Math.PI, 0, 0, 1)).toBeGreaterThan(bandAt(0, 0, 0, 1))
  expect(bandAt(Math.PI / 2, 0, 1, 0)).toBeGreaterThan(bandAt(0, 0, 1, 0))
})

it('spektrumringen: färre staplar tonas ut, inte på en gång, och matriserna är ändliga', () => {
  const s = ring()
  s.setParticles(1)
  s.update(input)
  expect(heights(s).every(h => Number.isFinite(h) && h > 0.5)).toBe(true)
  s.setParticles(0.35)
  s.update(input)
  expect(heights(s).every(h => h > 0.5)).toBe(true) // en bildruta senare syns alla ännu
  for (let t = 0; t < 200; t++) s.update(input)
  const shown = heights(s).filter(h => h > 0.5).length
  expect(shown).toBeGreaterThan(25)
  expect(shown).toBeLessThan(45)
  s.setParticles(1)
  s.update(input)
  expect(heights(s).filter(h => h > 0.5).length).toBe(shown) // tillbaka: växer fram, tänds inte på en gång
  s.dispose()
})

it('spektrumringen: pulsen höjer glöden, och ljuset följer inte ljudbanden', () => {
  const s = ring()
  s.update({ ...input, pulse: 0 })
  const dark = bars(s).material.color.clone()
  const low = heights(s)
  s.update(input)
  const glow = bars(s).material.color.clone()
  expect(glow.r).toBeGreaterThan(dark.r)
  expect(heights(s)[0]).toBeGreaterThan(low[0]) // staplarna studsar på pulsen
  s.update({ ...input, bands: { bass: 0, mid: 0, treble: 0 } })
  expect(bars(s).material.color.equals(glow)).toBe(true)
  s.dispose()
})

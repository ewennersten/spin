import type * as THREE from 'three'
import { expect, it } from 'vitest'
import { grid, heightAt } from './grid'

it('nätlandskapet: platt dal i mitten, och basen höjer de inre bergen', () => {
  expect(heightAt(0, 5, 1, 1, 1, 8)).toBe(0)
  expect(heightAt(8, 5, 1, 0, 0, 8)).toBeGreaterThan(heightAt(8, 5, 0, 0, 0, 8))
  expect(heightAt(38, 5, 0, 0, 1, 8)).toBeGreaterThan(heightAt(38, 5, 1, 0, 0, 8))
})

it('nätlandskapet: ändliga höjder, tätheten följer setParticles och dispose går att anropa', () => {
  const s = grid()
  const input = { intensity: 1, pulse: 1, bands: { bass: 1, mid: 1, treble: 1 }, color: '#ff0000', calm: false, timeSec: 1, dtSec: 0.016 }
  s.update(input)
  const lines = s.scene.children[0] as THREE.LineSegments
  expect(Array.from(lines.geometry.attributes.position.array).every(Number.isFinite)).toBe(true)
  const full = lines.geometry.attributes.position.count
  s.setParticles(0.35)
  s.update(input)
  expect(lines.geometry.attributes.position.count).toBeLessThan(full)
  s.dispose()
})

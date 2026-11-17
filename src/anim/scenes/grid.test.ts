import type * as THREE from 'three'
import { expect, it } from 'vitest'
import { grid, heightAt } from './grid'

const input = { intensity: 1, pulse: 1, bands: { bass: 1, mid: 1, treble: 1 }, color: '#ff0000', calm: false, calmMix: 0, timeSec: 1, dtSec: 0.016 }
const floor = (s: ReturnType<typeof grid>) => s.scene.children[0] as THREE.LineSegments
const ceiling = (s: ReturnType<typeof grid>) => s.scene.children[1] as THREE.LineSegments

it('nätlandskapet: platt dal i mitten, och basen höjer de inre bergen', () => {
  expect(heightAt(0, 5, 1, 1, 1, 8)).toBe(0)
  expect(heightAt(8, 5, 1, 0, 0, 8)).toBeGreaterThan(heightAt(8, 5, 0, 0, 0, 8))
  expect(heightAt(38, 5, 0, 0, 1, 8)).toBeGreaterThan(heightAt(38, 5, 1, 0, 0, 8))
})

it('nätlandskapet: ändliga höjder, tätheten följer setParticles och dispose går att anropa', () => {
  const s = grid()
  s.update(input)
  expect(Array.from(floor(s).geometry.attributes.position.array).every(Number.isFinite)).toBe(true)
  const full = floor(s).geometry.attributes.position.count
  const before = floor(s).geometry
  s.setParticles(1)
  expect(floor(s).geometry).toBe(before) // samma täthet: inget ombygge
  s.setParticles(0.35)
  s.update(input)
  expect(floor(s).geometry.attributes.position.count).toBeLessThan(full)
  expect(ceiling(s).geometry).toBe(floor(s).geometry)
  s.dispose()
})

it('nätlandskapet: golvets och takets berg möts inte, och ljusheten följer inte ljudbanden', () => {
  const s = grid()
  s.update({ ...input, dtSec: 0 })
  const ys = floor(s).geometry.attributes.position.array as Float32Array
  let top = 0
  for (let j = 1; j < ys.length; j += 3) top = Math.max(top, ys[j])
  expect(top).toBeGreaterThan(0)
  expect(top).toBeLessThan(ceiling(s).position.y - top) // taket hänger ned till takhöjden minus samma höjd
  const loud = Array.from(floor(s).geometry.attributes.color.array)
  s.update({ ...input, dtSec: 0, bands: { bass: 0, mid: 0, treble: 0 } })
  expect(Array.from(floor(s).geometry.attributes.color.array)).toEqual(loud)
  s.dispose()
})

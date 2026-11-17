import { expect, it } from 'vitest'
import { REST_SCENES } from './vila'

const input = { intensity: 0, pulse: 1, bands: { bass: 1, mid: 1, treble: 1 }, color: '#5F5E5A', calm: true, calmMix: 1, runIntensity: 0, timeSec: 3, dtSec: 0.016 }

it('viloscenerna går att skapa, uppdatera och släppa', () => {
  expect(REST_SCENES).toHaveLength(6)
  for (const make of REST_SCENES) {
    const s = make()
    expect(s.scene.children.length).toBeGreaterThan(0)
    for (let i = 0; i < 10; i++) s.update({ ...input, timeSec: 3 + i * 0.016 })
    s.setParticles(0.35)
    s.dispose()
  }
})

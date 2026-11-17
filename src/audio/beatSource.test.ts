import { expect, it } from 'vitest'
import { BeatDetector } from './beat'
import { BeatSource, type BeatFrame, type MicReading } from './beatSource'

const loud: MicReading = { level: 0.3, bass: 0.1, mid: 0.2, treble: 0.1 }
const quiet: MicReading = { level: 0.001, bass: 0, mid: 0, treble: 0 }
const count = (s: BeatSource, reading: MicReading | null, fromMs: number, toMs: number) => {
  let beats = 0, last: BeatFrame | null = null
  for (let t = fromMs; t < toMs; t += 1000 / 60) { last = s.update(reading, t); if (last.beat) beats++ }
  return { beats, mode: last!.mode }
}

it('går på intern takt utan mikrofon', () => {
  const r = count(new BeatSource(new BeatDetector()), null, 0, 10000)
  expect(r.mode).toBe('intern')
  expect(r.beats).toBeGreaterThanOrEqual(21)
  expect(r.beats).toBeLessThanOrEqual(22)
})
it('byter till intern takt efter fem sekunders tystnad och tillbaka när ljudet kommer', () => {
  const s = new BeatSource(new BeatDetector())
  expect(count(s, loud, 0, 1000).mode).toBe('mic')
  expect(count(s, quiet, 1000, 5900).mode).toBe('mic')
  expect(count(s, quiet, 5900, 7000).mode).toBe('intern')
  expect(count(s, loud, 7000, 7100).mode).toBe('mic')
})
it('klarar att mikrofonen försvinner mitt i passet', () => {
  const s = new BeatSource(new BeatDetector())
  count(s, loud, 0, 1000)
  expect(count(s, null, 1000, 3000)).toMatchObject({ mode: 'intern' })
})
it('tvingar intern takt när mikrofonen är avstängd med M', () => {
  const s = new BeatSource(new BeatDetector()); s.enabled = false
  expect(count(s, loud, 0, 1000).mode).toBe('intern')
})
it('ger aldrig två slag tätare än 400 ms, inte heller när läget byts', () => {
  const s = new BeatSource(new BeatDetector())
  const beats: number[] = []
  for (let t = 0; t < 20000; t += 1000 / 60) {
    s.enabled = Math.floor(t / 700) % 2 === 0 // M trycks var 700:e ms
    const bass = t % 300 < 1000 / 60 ? 1 : 0.1
    if (s.update({ ...loud, bass }, t).beat) beats.push(t)
  }
  const gaps = beats.slice(1).map((t, i) => t - beats[i])
  expect(beats.length).toBeGreaterThan(20)
  expect(Math.min(...gaps)).toBeGreaterThanOrEqual(400)
})

it('följer slagen från aubio och visar pulsen leadMs före nästa slag', () => {
  const s = new BeatSource(new BeatDetector())
  s.leadMs = 100
  const period = 469
  const pulses: number[] = []
  let next = 1000
  for (let t = 0; t < 12000; t += 1000 / 60) {
    const beats: number[] = []
    while (next <= t) { beats.push(next); next += period }
    if (s.update({ ...loud, beats }, t).beat) pulses.push(t)
  }
  const late = pulses.filter(t => t > 5000)
  expect(late.length).toBeGreaterThan(12)
  for (const t of late) {
    const ahead = (period - ((t - 1000) % period)) % period
    expect(ahead).toBeGreaterThan(100 - 17)
    expect(ahead).toBeLessThanOrEqual(100)
  }
})

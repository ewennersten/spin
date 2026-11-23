import { expect, it } from 'vitest'
import { BandLevels, BeatPulse, SceneDirector, calmFor, follow, intensityFor, shakeAmount } from './drive'

it('intensitet: 50 % ger 0, 120 % ger 1, rakt emellan', () => {
  expect(intensityFor(50)).toBe(0)
  expect(intensityFor(40)).toBe(0)
  expect(intensityFor(85)).toBeCloseTo(0.5)
  expect(intensityFor(120)).toBe(1)
  expect(intensityFor(150)).toBe(1)
})
it('follow når 63 % av vägen på en tidskonstant och hoppar inte efter ett långt glapp', () => {
  expect(follow(0, 1, 100, 100)).toBeCloseTo(0.632, 3)
  expect(follow(0.2, 1, 0, 1500)).toBe(0.2)
  expect(follow(0, 1, 10000, 1500)).toBe(follow(0, 1, 100, 1500)) // glappet räknas som högst 100 ms
})
it('slagpulsen stiger på 30 ms och klingar av', () => {
  const p = new BeatPulse()
  expect(p.value(0)).toBe(0)
  p.beat(1000)
  expect(p.value(1000)).toBe(0)           // inget hopp i samma ögonblick
  expect(p.value(1015)).toBeGreaterThan(0)
  expect(p.value(1015)).toBeLessThan(1)
  expect(p.value(1030)).toBeCloseTo(1)
  expect(p.value(1280)).toBeCloseTo(Math.exp(-1), 2) // 250 ms efter toppen
  expect(p.value(3000)).toBeLessThan(0.01)
})
it('ett nytt slag mitt i avklingningen börjar från nuvarande värde', () => {
  const p = new BeatPulse()
  p.beat(0)
  const before = p.value(400)
  p.beat(400)
  expect(p.value(400)).toBeCloseTo(before)
  expect(p.value(430)).toBeCloseTo(1)
})
it('ljudbanden: jämn nivå från mikrofonen närmar sig 1 och ett plötsligt hopp jämnas ut', () => {
  const b = new BandLevels()
  const mic = (bass: number) => ({ level: 0.1, bass, mid: bass, treble: bass, beat: false, mode: 'mic' as const })
  let out = b.update(mic(0.01), 0, 16)
  for (let t = 16; t < 3000; t += 16) out = b.update(mic(0.01), t, 16)
  expect(out.bass).toBeGreaterThan(0.95)
  const quiet = new BandLevels()
  for (let t = 0; t < 3000; t += 16) quiet.update(mic(0.001), t, 16)
  const prev = quiet.update(mic(0.001), 3000, 16).bass
  const next = quiet.update(mic(0.05), 3016, 16).bass
  expect(next - prev).toBeLessThanOrEqual(1 - Math.exp(-16 / 150) + 1e-9) // tidskonstant 150 ms
})
it('ljudbanden: efter en dold flik stiger nivån inte mer än ett vanligt steg', () => {
  const mic = (bass: number) => ({ level: 0.1, bass, mid: bass, treble: bass, beat: false, mode: 'mic' as const })
  // Toppen sätts av en hög nivå, sedan jämn lägre nivå. Ett glapp på 10 s ska ge samma steg som 100 ms.
  const run = (gapMs: number) => {
    const b = new BandLevels()
    b.update(mic(0.05), 0, 16)
    for (let t = 16; t < 1000; t += 16) b.update(mic(0.01), t, 16)
    return b.update(mic(0.01), 1000 + gapMs, gapMs).bass
  }
  expect(run(10000)).toBeCloseTo(run(100), 9)
})
it('ljudbanden: tystnad ger inga NaN, och den interna takten ger lugna värden mellan 0 och 1', () => {
  const b = new BandLevels()
  const zero = { level: 0, bass: 0, mid: 0, treble: 0, beat: false, mode: 'mic' as const }
  expect(Object.values(b.update(zero, 0, 16)).every(Number.isFinite)).toBe(true)
  const i = new BandLevels()
  const intern = { ...zero, mode: 'intern' as const }
  let prev = i.update(intern, 0, 16)
  for (let t = 16; t < 20000; t += 16) {
    const out = i.update(intern, t, 16)
    for (const k of ['bass', 'mid', 'treble'] as const) {
      expect(out[k]).toBeGreaterThanOrEqual(0)
      expect(out[k]).toBeLessThanOrEqual(1)
      expect(Math.abs(out[k] - prev[k])).toBeLessThan(0.05)
    }
    prev = out
  }
})
it('scenvalet: ny scen vid nytt block, aldrig samma som nyss, högst var 20:e sekund', () => {
  const d = new SceneDirector(4, () => 0)
  const first = d.pick(0, 0)
  expect(d.pick(0, 30000)).toBe(first)        // samma block: inget byte
  const second = d.pick(1, 30000)
  expect(second).not.toBe(first)
  expect(d.pick(2, 40000)).toBe(second)       // bara 10 s sedan bytet
  expect(d.pick(3, 50000)).not.toBe(second)   // 20 s sedan bytet
})
it('scenvalet: en tvingad scen gäller alltid, och med en enda scen blir det den', () => {
  expect(new SceneDirector(4, Math.random, 2).pick(5, 99999)).toBe(2)
  const one = new SceneDirector(1)
  expect(one.pick(0, 0)).toBe(0)
  expect(one.pick(1, 30000)).toBe(0)
})
it('scenvalet: en spärrad scen väljs aldrig, och visas den byts den direkt', () => {
  const d = new SceneDirector(4, () => 0.99)
  expect(d.pick(0, 0)).toBe(3)
  expect(d.pick(0, 1000, false, [3])).toBe(2) // samma block och bara en sekund senare, men spärrad: byts direkt
  for (let i = 0; i < 20; i++) expect(d.pick(1 + i, 30000 * (i + 1), false, [3])).not.toBe(3)
  expect(new SceneDirector(1).pick(0, 0, false, [0])).toBe(0) // spärras alla visas ändå något
})

it('scenvalet: i ett långt block byts scenen var 3:e minut', () => {
  const d = new SceneDirector(4, () => 0)
  const first = d.pick(0, 0)
  expect(d.pick(0, 179_000)).toBe(first)
  const second = d.pick(0, 180_000)
  expect(second).not.toBe(first)
  expect(d.pick(0, 300_000)).toBe(second) // två minuter efter bytet
  expect(d.pick(0, 360_000)).not.toBe(second)
})

it('lugnt läge under vila och paus', () => {
  expect(calmFor(55, true)).toBe(true)
  expect(calmFor(60, true)).toBe(false)
  expect(calmFor(100, false)).toBe(true)
})
it('kameraskak från intensitet 0,8', () => {
  expect(shakeAmount(0.8)).toBe(0)
  expect(shakeAmount(0.9)).toBeCloseTo(0.5)
  expect(shakeAmount(1)).toBe(1)
})

it('scenvalet: i vila bara viloscener, annars bara vanliga, och bytet sker direkt', () => {
  const d = new SceneDirector(4, () => 0.5, null, 3)
  expect(d.pick(0, 0, false)).toBeLessThan(4)
  const rest = d.pick(1, 1000, true) // bara en sekund senare, men vila: byts direkt
  expect(rest).toBeGreaterThanOrEqual(4)
  expect(rest).toBeLessThan(7)
  expect(d.pick(1, 5000, true)).toBe(rest)
  expect(d.pick(2, 6000, false)).toBeLessThan(4) // tillbaka direkt
  for (let i = 0; i < 50; i++) {
    const s = d.pick(10 + i, 100000 + i * 30000, i % 2 === 0)
    expect(i % 2 === 0 ? s >= 4 : s < 4).toBe(true)
  }
})

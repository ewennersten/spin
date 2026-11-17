import { expect, it } from 'vitest'
import { BeatPredictor } from './predict'

// Matar in hörda slag och räknar när förutsägelsen ger puls, i bildrutor om 60 per sekund.
function run(p: BeatPredictor, heard: number[], toMs: number, leadMs: number) {
  const fired: number[] = []
  let next = 0
  for (let t = 0; t < toMs; t += 1000 / 60) {
    while (next < heard.length && heard[next] <= t) p.onset(heard[next++])
    if (p.locked(t) && p.due(t, leadMs)) fired.push(t)
  }
  return fired
}
const grid = (periodMs: number, n: number, from = 0) => Array.from({ length: n }, (_, i) => from + i * periodMs)

it('hittar takten och ger puls före slaget', () => {
  const p = new BeatPredictor()
  const heard = grid(469, 30, 1000) // 128 slag per minut
  const fired = run(p, heard, 15000, 100)
  expect(p.bpm).toBeCloseTo(128, 0)
  // Efter låsningen kommer varje puls 100 ms före slaget, på en bildruta när.
  const late = fired.filter(t => t > 5000 && t < 14400) // efter sista hörda slaget fortsätter takten
  expect(late.length).toBeGreaterThan(15)
  for (const t of late) {
    const beat = heard.find(b => b - t > 0 && b - t < 200)!
    expect(beat - t).toBeGreaterThan(100 - 17)
    expect(beat - t).toBeLessThanOrEqual(100)
  }
})

it('fyller i slag som inte hörs och tål slag mellan taktslagen', () => {
  const p = new BeatPredictor()
  const heard = grid(500, 40, 1000).filter((_, i) => i < 6 || i % 3 !== 0) // vart tredje slag hörs inte
  heard.push(...[3250, 6250, 9250]) // enstaka slag mitt emellan
  heard.sort((a, b) => a - b)
  const fired = run(p, heard, 20000, 0)
  const late = fired.filter(t => t > 6000 && t < 20000)
  // Ett slag var 500:e ms, även de som inte hördes, och inga extra mitt emellan.
  expect(late.length).toBeGreaterThanOrEqual(27)
  expect(late.length).toBeLessThanOrEqual(28)
  const gaps = late.slice(1).map((t, i) => t - late[i])
  expect(Math.min(...gaps)).toBeGreaterThan(480)
})

it('förstår att slag tätt efter varandra hör till en långsammare takt', () => {
  const p = new BeatPredictor()
  run(p, grid(250, 40, 1000), 12000, 0) // 240 per minut går inte att pulsera i: blir 120
  expect(p.bpm).toBeCloseTo(120, 0)
})

it('släpper låset när musiken slutar och låser igen på en ny takt', () => {
  const p = new BeatPredictor()
  run(p, grid(500, 20, 0), 10000, 0)
  expect(p.locked(10000)).toBe(true)
  expect(p.locked(16000)).toBe(false) // inget hört slag på åtta perioder
  const q = new BeatPredictor()
  run(q, [...grid(500, 20, 0), ...grid(430, 30, 12000)], 26000, 0)
  expect(q.locked(25000)).toBe(true)
  expect(q.bpm).toBeCloseTo(60000 / 430, 0)
})

it('lägger takten på de starka slagen, inte på svaga slag mitt emellan', () => {
  const p = new BeatPredictor()
  const fired: number[] = []
  for (let i = 0; i < 40; i++) {
    const beat = 1000 + i * 469
    if (i % 2) p.onset(beat, 1) // virveln på 2 och 4
    p.onset(beat + 234, 0.3) // hi-hat mitt emellan, varje gång
    for (let t = beat; t < beat + 469; t += 1000 / 60) if (p.locked(t) && p.due(t, 0)) fired.push(t)
  }
  const late = fired.filter(t => t > 8000)
  expect(late.length).toBeGreaterThan(20)
  for (const t of late) {
    const off = ((t - 1000) % 469 + 469) % 469
    expect(Math.min(off, 469 - off)).toBeLessThan(40) // på taktslaget, inte 234 ms bredvid
  }
})

it('låser sällan på slag utan takt', () => {
  let seed = 7
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  let frames = 0
  let locked = 0
  for (let s = 0; s < 30; s++) {
    const p = new BeatPredictor()
    let t = 1000
    for (let i = 0; i < 25; i++) {
      p.onset(t)
      const next = t + 300 + rand() * 1200
      for (let f = t; f < next; f += 1000 / 60) { frames++; if (p.locked(f)) locked++ }
      t = next
    }
  }
  expect(locked / frames).toBeLessThan(0.05)
})

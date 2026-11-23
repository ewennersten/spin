import type { BeatFrame } from '../audio/beatSource'
import type { Bands } from './types'

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

// 0 vid 50 % av FTP, 1 vid 120 %.
export function intensityFor(pctNow: number): number {
  return clamp((pctNow - 50) / 70, 0, 1)
}

// Exponentiell utjämning. Glappet räknas som högst 100 ms, så att en dold flik inte ger ett ryck.
export function follow(current: number, target: number, dtMs: number, tauMs: number): number {
  return current + (target - current) * (1 - Math.exp(-Math.min(dtMs, 100) / tauMs))
}

// Kort uppgång, så att toppen syns i takt med musiken. Två bildrutor, så att det inte blir ett hopp i ett enda ögonblick.
const RISE_MS = 30
const DECAY_MS = 250

// Stiger till 1 på 30 ms från värdet vid slaget, klingar sedan av.
export class BeatPulse {
  #at: number | null = null
  #from = 0

  beat(nowMs: number): void {
    this.#from = this.value(nowMs)
    this.#at = nowMs
  }

  value(nowMs: number): number {
    if (this.#at === null) return 0
    const t = Math.max(0, nowMs - this.#at)
    if (t >= RISE_MS) return Math.exp(-(t - RISE_MS) / DECAY_MS)
    const s = t / RISE_MS
    return this.#from + (1 - this.#from) * s * s * (3 - 2 * s)
  }
}

const KEYS = ['bass', 'mid', 'treble'] as const
const PEAK_MS = 4000
const PEAK_MIN = 0.002
const BAND_TAU_MS = 150
const INTERN_PERIOD_MS = { bass: 1800, mid: 2900, treble: 4100 }

// Mikrofonens band mot en långsamt fallande topp, eller lugna sinusvågor i den interna takten.
export class BandLevels {
  #peak: Bands = { bass: PEAK_MIN, mid: PEAK_MIN, treble: PEAK_MIN }
  #out: Bands | null = null

  update(frame: BeatFrame, nowMs: number, dtMs: number): Bands {
    const target = { bass: 0, mid: 0, treble: 0 }
    for (const k of KEYS) {
      if (frame.mode === 'mic') {
        const x = frame[k]
        // Glappet räknas som högst 100 ms, så att musiken inte läses nära full nivå efter en dold flik.
        this.#peak[k] = Math.max(x, this.#peak[k] * Math.exp(-Math.min(dtMs, 100) / PEAK_MS), PEAK_MIN)
        target[k] = Math.min(1, x / this.#peak[k])
      } else {
        target[k] = 0.45 + 0.3 * Math.sin((2 * Math.PI * nowMs) / INTERN_PERIOD_MS[k])
      }
    }
    const prev = this.#out
    // Första anropet sätter värdena direkt, annars stiger de från 0.
    this.#out = prev === null ? target : {
      bass: follow(prev.bass, target.bass, dtMs, BAND_TAU_MS),
      mid: follow(prev.mid, target.mid, dtMs, BAND_TAU_MS),
      treble: follow(prev.treble, target.treble, dtMs, BAND_TAU_MS),
    }
    return this.#out
  }
}

const SCENE_MIN_MS = 20000
const SCENE_MAX_MS = 180000 // i långa block byts scenen ändå var 3:e minut

// Byter scen vid nytt block, högst var 20:e sekund och aldrig till samma som nyss. Har samma scen visats i 3 minuter
// byts den även mitt i ett block. Scenerna 0 till count − 1 är de vanliga och de restCount följande är viloscenerna. I vila (rest) väljs bara viloscener och annars bara vanliga;
// byts det ena mot det andra byts scenen direkt, utan att vänta 20 sekunder.
export class SceneDirector {
  #current = -1
  #block = 0
  #changedAt = 0

  constructor(readonly count: number, readonly random: () => number = Math.random, readonly forced: number | null = null, readonly restCount = 0) {}

  // banned är scener som inte får visas just nu (för lugna för intensiteten). Visas en av dem byts den direkt.
  pick(blockIndex: number, nowMs: number, rest = false, banned: readonly number[] = []): number {
    if (this.forced !== null) return this.forced
    const [from, n] = rest && this.restCount ? [this.count, this.restCount] : [0, this.count]
    const all = [...Array(n).keys()].map(i => from + i)
    const allowed = all.filter(i => !banned.includes(i))
    const pool = allowed.length ? allowed : all
    if (!pool.includes(this.#current)) {
      this.#current = pool[Math.floor(this.random() * pool.length)]
      this.#changedAt = nowMs
    } else if (pool.length > 1 && (blockIndex !== this.#block ? nowMs - this.#changedAt >= SCENE_MIN_MS : nowMs - this.#changedAt >= SCENE_MAX_MS)) {
      const others = pool.filter(i => i !== this.#current)
      this.#current = others[Math.floor(this.random() * others.length)]
      this.#changedAt = nowMs
    }
    // Blocket noteras även när bytet nekas, så att ett nekat byte inte görs senare mitt i blocket.
    this.#block = blockIndex
    return this.#current
  }
}

// Zonen Vila eller paus.
export function calmFor(pctNow: number, running: boolean): boolean {
  return !running || pctNow < 60
}

// Så högt att inget tak når ned till vilans glöd i någon scen (Svärmen behöver minst 2,85).
export const NO_CAP = 3

// Taket för lugnt läge: intensiteten samma procent har när passet går, så att en paus aldrig blir ljusare än passet.
// Under 60 % är det lugnt även när passet går, och då gäller inget tak. Följer mjukt med tau 800 ms, som calmMix,
// så att glöden inte rycker vid 60 %. current null (första bildrutan) sätter värdet direkt.
export function calmCap(current: number | null, pctNow: number, dtMs: number): number {
  const target = calmFor(pctNow, true) ? NO_CAP : intensityFor(pctNow)
  return current === null ? target : follow(current, target, dtMs, 800)
}


// Skrivet som intensity × 5 − 4, eftersom (1 − 0,8) / 0,2 blir 0,9999… i flyttal.
export function shakeAmount(intensity: number): number {
  return clamp(intensity * 5 - 4, 0, 1)
}

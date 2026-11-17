// Musik håller takten. Ur slagen som appen hör räknas takten och var i takten låten är, och nästa slag förutses.
// Då kan pulsen visas en stund före slaget, så att fördröjningen i ljudfångst och skärm tas igen, och slag som inte
// hörs (svag bas, ett tyst parti) fylls i. Låter det inte som en jämn takt låser den inte, och då gäller de hörda slagen.

const MIN_MS = 400 // högst 150 slag per minut, som pulsen hinner med; snabbare takt räknas som halva farten
const MAX_MS = 1000
const TOL = 0.06 // ett slag ligger i takt om det är inom 6 % av perioden från rutnätet (28 ms vid 128 slag per minut)
const LOCK_HITS = 4 // så många slag i takt innan förutsägelsen tar över
const LOST_PERIODS = 8 // utan ett hört slag i takt så här länge släpper låset
const KEEP = 16

interface Onset { t: number; w: number }
interface Fit { anchor: number; period: number; lastHit: number; hits: number }

// Ungefärlig period. Avståndet mellan två hörda slag kan vara flera perioder (missade slag) eller en del av en
// (slag mellan taktslagen). Gissningen som stämmer med flest avstånd vinner. 0 när inget stämmer med minst tre.
function roughPeriod(onsets: Onset[]): number {
  const gaps = onsets.slice(1).map((o, i) => o.t - onsets[i].t)
  let best = 0
  let bestScore = 2
  for (const gap of gaps) {
    let c = gap
    while (c < MIN_MS) c *= 2
    while (c >= MAX_MS) c /= 2
    let score = 0
    let sum = 0
    for (const g of gaps) {
      const k = g >= c ? Math.round(g / c) : 1 / Math.round(c / g)
      if (Math.abs(g / k - c) <= TOL * c) { score++; sum += g / k }
    }
    if (score > bestScore) { bestScore = score; best = sum / score }
  }
  return best
}

// Rutnätet som de starka slagen ligger på. Varje hört slag prövas som utgångspunkt, och det rutnät där slagen
// väger mest vinner, så att virvel och bastrumma bestämmer takten och inte en svag hi-hat mitt emellan.
// Takt och läge anpassas sedan till slagen på rutnätet (minsta kvadrat, viktat).
function fitGrid(onsets: Onset[], c: number): Fit | null {
  const total = onsets.reduce((s, o) => s + o.w, 0)
  let best: { on: { o: Onset; n: number }[]; weight: number } | null = null
  for (const start of onsets) {
    const on = onsets
      .map(o => ({ o, n: Math.round((o.t - start.t) / c) }))
      .filter(({ o, n }) => Math.abs(o.t - start.t - n * c) <= TOL * c)
    const weight = on.reduce((s, { o }) => s + o.w, 0)
    if (!best || weight > best.weight) best = { on, weight }
  }
  // Minst hälften av ljudet ska ligga på rutnätet, och minst vartannat taktslag ska ha hörts, annars är det ingen takt.
  if (!best || best.on.length < LOCK_HITS || best.weight < total / 2) return null
  const ns = best.on.map(({ n }) => n)
  if (best.on.length < (Math.max(...ns) - Math.min(...ns) + 1) / 2) return null
  let sw = 0, sn = 0, st = 0, snn = 0, snt = 0
  for (const { o, n } of best.on) { sw += o.w; sn += o.w * n; st += o.w * o.t; snn += o.w * n * n; snt += o.w * n * o.t }
  const den = sw * snn - sn * sn
  let period = den > 0 ? (sw * snt - sn * st) / den : c
  if (Math.abs(period - c) > TOL * c) period = c
  const anchor = (st - period * sn) / sw
  return { anchor, period, lastHit: Math.max(...best.on.map(({ o }) => o.t)), hits: best.on.length }
}

export class BeatPredictor {
  #onsets: Onset[] = []
  #fit: Fit | null = null
  #lastFired = -Infinity

  get bpm(): number { return this.#fit ? 60000 / this.#fit.period : 0 }

  locked(nowMs: number): boolean {
    const f = this.#fit
    return !!f && nowMs - f.lastHit < LOST_PERIODS * f.period
  }

  // Ett slag som hördes vid tMs. weight är hur kraftigt det var.
  onset(tMs: number, weight = 1): void {
    this.#onsets.push({ t: tMs, w: weight })
    if (this.#onsets.length > KEEP) this.#onsets.shift()
    const c = roughPeriod(this.#onsets)
    this.#fit = c ? fitGrid(this.#onsets, c) : null
  }

  // Sant en gång per förutsagt slag, leadMs före det. Anropas varje bildruta medan locked är sant.
  due(nowMs: number, leadMs: number): boolean {
    const f = this.#fit
    if (!f) return false
    const n = Math.floor((nowMs + leadMs - f.anchor) / f.period)
    const fireAt = f.anchor + n * f.period - leadMs
    if (nowMs - fireAt >= f.period / 2 || fireAt <= this.#lastFired + f.period / 2) return false
    this.#lastFired = fireAt
    return true
  }
}

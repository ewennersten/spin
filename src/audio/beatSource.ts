import type { BeatDetector } from './beat'
import { BeatPredictor } from './predict'

// level är RMS av tidssignalen. bass, mid och treble är linjär amplitud per fack, i praktiken ungefär 0,0001 till 0,05 och inte 0 till 1.
// onset är hur mycket ljudet just ökade över alla frekvenser (se mic.ts). Saknas det letar detektorn slag i basen.
// beats är tiderna för slagen som aubio har hittat sedan förra läsningen. Saknas de används den egna detektorn.
export interface MicReading { level: number; bass: number; mid: number; treble: number; onset?: number; beats?: number[] }
export interface BeatFrame extends MicReading { beat: boolean; mode: 'mic' | 'intern' }

const INTERN_MS = 60000 / 130
const QUIET = 0.01
const QUIET_MS = 5000
const GAP_MS = 400 // högst 2,5 slag per sekund, även när läget byts

// Mikrofonens slag när den hörs, annars en intern takt på 130 slag per minut. När de hörda slagen går i jämn takt
// förutses nästa slag, och pulsen kommer leadMs före det (se predict.ts).
export class BeatSource {
  enabled = true
  leadMs = 120
  readonly predictor = new BeatPredictor()
  // Senaste bilden från update, för panelen som ritas i samma bildruta.
  frame: BeatFrame = { level: 0, bass: 0, mid: 0, treble: 0, beat: false, mode: 'intern' }
  #tick = -1
  #quietSince: number | null = null
  #lastBeat = -Infinity

  constructor(readonly detector: BeatDetector) {}

  update(reading: MicReading | null, nowMs: number): BeatFrame {
    // Den interna takten räknas ur tiden, så att den varken driver eller spelar upp missade slag i efterhand.
    const tick = Math.floor(nowMs / INTERN_MS)
    const internBeat = tick !== this.#tick
    this.#tick = tick
    if (reading && reading.level < QUIET) this.#quietSince ??= nowMs
    else this.#quietSince = null
    const heard = reading !== null && (this.#quietSince === null || nowMs - this.#quietSince <= QUIET_MS)
    let micBeat = false
    if (this.enabled && heard) {
      let onset: boolean
      if (reading.beats) {
        for (const t of reading.beats) this.predictor.onset(t)
        onset = reading.beats.length > 0
      } else {
        const energy = reading.onset ?? reading.bass
        onset = this.detector.feed(energy, nowMs)
        if (onset) this.predictor.onset(nowMs, energy)
      }
      micBeat = this.predictor.locked(nowMs) ? this.predictor.due(nowMs, this.leadMs) : onset
    }
    this.frame = this.enabled && heard
      ? { ...reading, beat: micBeat, mode: 'mic' }
      : { level: reading?.level ?? 0, bass: 0, mid: 0, treble: 0, beat: internBeat, mode: 'intern' }
    if (this.frame.beat && nowMs - this.#lastBeat < GAP_MS) this.frame.beat = false
    if (this.frame.beat) this.#lastBeat = nowMs
    return this.frame
  }
}

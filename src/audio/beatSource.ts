import type { BeatDetector } from './beat'

export interface MicReading { level: number; bass: number; mid: number; treble: number }
export interface BeatFrame extends MicReading { beat: boolean; mode: 'mic' | 'intern' }

const INTERN_MS = 60000 / 130
const QUIET = 0.01
const QUIET_MS = 5000

// Mikrofonens slag när den hörs, annars en intern takt på 130 slag per minut.
export class BeatSource {
  enabled = true
  // Senaste bilden från update, för panelen som ritas i samma bildruta.
  frame: BeatFrame = { level: 0, bass: 0, mid: 0, treble: 0, beat: false, mode: 'intern' }
  #tick = -1
  #quietSince: number | null = null

  constructor(readonly detector: BeatDetector) {}

  update(reading: MicReading | null, nowMs: number): BeatFrame {
    // Den interna takten räknas ur tiden, så att den varken driver eller spelar upp missade slag i efterhand.
    const tick = Math.floor(nowMs / INTERN_MS)
    const internBeat = tick !== this.#tick
    this.#tick = tick
    if (reading && reading.level < QUIET) this.#quietSince ??= nowMs
    else this.#quietSince = null
    const heard = reading !== null && (this.#quietSince === null || nowMs - this.#quietSince <= QUIET_MS)
    this.frame = this.enabled && heard
      ? { ...reading, beat: this.detector.feed(reading.bass, nowMs), mode: 'mic' }
      : { level: reading?.level ?? 0, bass: 0, mid: 0, treble: 0, beat: internBeat, mode: 'intern' }
    return this.frame
  }
}
